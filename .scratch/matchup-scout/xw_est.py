"""Estimators of Savant's estimated_woba_using_speedangle from (launch_speed, launch_angle). Standard library only.

Each estimator is a function  fit(train) -> model  where train is a list of (ev, la, est) tuples, and the model has
  model.predict(ev, la) -> float
  model.table() -> a JSON-ready object that holds everything predict() needs (so its byte size is honest)

Grid estimators (cascade, shrink) store bins. Smoothers (kernel, knnbox) work on a 1 mph x 1 degree grid.
"""
import gzip, json, math

EV_MAX = 125
LA_MIN, LA_MAX = -90, 90
NE, NL = EV_MAX + 1, LA_MAX - LA_MIN + 1


def ci(ev):
    return min(max(int(round(ev)), 0), EV_MAX)


def cj(la):
    return min(max(int(round(la)), LA_MIN), LA_MAX) - LA_MIN


def size_of(obj):
    raw = json.dumps(obj, separators=(',', ':')).encode()
    return len(raw), len(gzip.compress(raw, 9))


def mill(v):
    return int(round(v * 1000))


# ---------- grid bins ----------
class Cascade:
    """Finest bin with at least `minn` balls wins. A coarser bin answers when the finer one is thin. Then the global mean."""
    def __init__(self, train, levels=((1, 1), (2, 4), (4, 8), (8, 16)), minn=1):
        self.levels, self.minn = levels, minn
        self.bins = []
        for se, sl in levels:
            acc = {}
            for ev, la, y in train:
                k = (math.floor(ev / se), math.floor(la / sl))
                a = acc.setdefault(k, [0, 0.0])
                a[0] += 1
                a[1] += y
            self.bins.append(acc)
        self.mean = sum(y for _, _, y in train) / len(train)

    def predict(self, ev, la):
        for (se, sl), acc in zip(self.levels, self.bins):
            a = acc.get((math.floor(ev / se), math.floor(la / sl)))
            if a and a[0] >= self.minn:
                return a[1] / a[0]
        return self.mean

    def table(self):
        out = {'mean': mill(self.mean), 'levels': []}
        for (se, sl), acc in zip(self.levels, self.bins):
            out['levels'].append({'ev': se, 'la': sl, 'bins': {f'{k[0]},{k[1]}': mill(a[1] / a[0]) for k, a in acc.items() if a[0] >= self.minn}})
        return out


class Shrink:
    """Each bin blends its own mean with the prediction of the next coarser bin: (n*mean + m*coarse) / (n + m)."""
    def __init__(self, train, levels=((1, 1), (2, 4), (4, 8), (8, 16)), m=5):
        self.levels, self.m = levels, m
        self.bins = []
        for se, sl in levels:
            acc = {}
            for ev, la, y in train:
                k = (math.floor(ev / se), math.floor(la / sl))
                a = acc.setdefault(k, [0, 0.0])
                a[0] += 1
                a[1] += y
            self.bins.append(acc)
        self.mean = sum(y for _, _, y in train) / len(train)
        # Precompute the shrunk value of every non-empty bin, coarsest first.
        self.val = [None] * len(levels)
        for lvl in range(len(levels) - 1, -1, -1):
            se, sl = levels[lvl]
            vals = {}
            for k, (n, s) in self.bins[lvl].items():
                coarse = self._coarse(lvl, k)
                vals[k] = (s + m * coarse) / (n + m)
            self.val[lvl] = vals

    def _coarse(self, lvl, k):
        if lvl == len(self.levels) - 1:
            return self.mean
        se, sl = self.levels[lvl]
        ev, la = k[0] * se, k[1] * sl
        se2, sl2 = self.levels[lvl + 1]
        k2 = (math.floor(ev / se2), math.floor(la / sl2))
        return self.val[lvl + 1].get(k2, self.mean) if self.val[lvl + 1] is not None else self.mean

    def predict(self, ev, la):
        for lvl, (se, sl) in enumerate(self.levels):
            v = self.val[lvl].get((math.floor(ev / se), math.floor(la / sl)))
            if v is not None:
                return v
        return self.mean

    def table(self):
        return {'mean': mill(self.mean), 'levels': [{'ev': se, 'la': sl, 'bins': {f'{k[0]},{k[1]}': mill(v) for k, v in self.val[i].items()}} for i, (se, sl) in enumerate(self.levels)]}


# ---------- 1x1 grid smoothers ----------
def _grids(train):
    cnt = [[0.0] * NL for _ in range(NE)]
    sm = [[0.0] * NL for _ in range(NE)]
    for ev, la, y in train:
        i, j = ci(ev), cj(la)
        cnt[i][j] += 1
        sm[i][j] += y
    return cnt, sm


def _blur(grid, se, sl):
    """Separable Gaussian blur, truncated at 3 sigma. Skips empty rows and columns for speed."""
    re_, rl = max(1, int(3 * se)), max(1, int(3 * sl))
    ke = [math.exp(-0.5 * (d / se) ** 2) for d in range(-re_, re_ + 1)]
    kl = [math.exp(-0.5 * (d / sl) ** 2) for d in range(-rl, rl + 1)]
    tmp = [[0.0] * NL for _ in range(NE)]
    for i in range(NE):
        row = grid[i]
        if not any(row):
            continue
        out = tmp[i]
        for j, v in enumerate(row):
            if v:
                for d, w in zip(range(-rl, rl + 1), kl):
                    jj = j + d
                    if 0 <= jj < NL:
                        out[jj] += v * w
    res = [[0.0] * NL for _ in range(NE)]
    for i in range(NE):
        row = tmp[i]
        if not any(row):
            continue
        for d, w in zip(range(-re_, re_ + 1), ke):
            ii = i + d
            if 0 <= ii < NE:
                out = res[ii]
                for j, v in enumerate(row):
                    if v:
                        out[j] += v * w
    return res


class Kernel:
    """Nadaraya-Watson with a Gaussian kernel (sigma in grid cells: 1 mph, 1 degree). Falls back to a 3x wider kernel, then the global mean."""
    def __init__(self, train, se=2.0, sl=4.0, floor=0.5):
        self.mean = sum(y for _, _, y in train) / len(train)
        cnt, sm = _grids(train)
        self.floor = floor
        c1, s1 = _blur(cnt, se, sl), _blur(sm, se, sl)
        c2, s2 = _blur(cnt, 3 * se, 3 * sl), _blur(sm, 3 * se, 3 * sl)
        self.tab = [[None] * NL for _ in range(NE)]
        for i in range(NE):
            for j in range(NL):
                if c1[i][j] >= floor:
                    self.tab[i][j] = s1[i][j] / c1[i][j]
                elif c2[i][j] >= floor:
                    self.tab[i][j] = s2[i][j] / c2[i][j]
        self.cells = sum(1 for r in self.tab for v in r if v is not None)

    def predict(self, ev, la):
        v = self.tab[ci(ev)][cj(la)]
        return self.mean if v is None else v

    def table(self):
        # Dense rows over EV; each row stores thousandths, -1 for an empty cell. Rows with no cell are empty lists.
        return {'mean': mill(self.mean), 'rows': [[(-1 if v is None else mill(v)) for v in r] if any(v is not None for v in r) else [] for r in self.tab]}


class KnnBox:
    """Smallest box (half-widths a*se mph, a*sl degrees) around the ball that holds at least k training balls. Mean of the box."""
    def __init__(self, train, k=20, se=1, sl=2):
        self.k, self.se, self.sl = k, se, sl
        self.mean = sum(y for _, _, y in train) / len(train)
        cnt, sm = _grids(train)
        # Integral images, (NE+1) x (NL+1).
        self.C = [[0.0] * (NL + 1) for _ in range(NE + 1)]
        self.S = [[0.0] * (NL + 1) for _ in range(NE + 1)]
        for i in range(NE):
            rc = rs = 0.0
            for j in range(NL):
                rc += cnt[i][j]
                rs += sm[i][j]
                self.C[i + 1][j + 1] = self.C[i][j + 1] + rc
                self.S[i + 1][j + 1] = self.S[i][j + 1] + rs
        self.cache = {}

    def _box(self, M, i0, i1, j0, j1):
        return M[i1 + 1][j1 + 1] - M[i0][j1 + 1] - M[i1 + 1][j0] + M[i0][j0]

    def predict(self, ev, la):
        i, j = ci(ev), cj(la)
        key = (i, j)
        v = self.cache.get(key)
        if v is None:
            a = 0
            while True:
                i0, i1 = max(0, i - a * self.se), min(NE - 1, i + a * self.se)
                j0, j1 = max(0, j - a * self.sl), min(NL - 1, j + a * self.sl)
                n = self._box(self.C, i0, i1, j0, j1)
                if n >= self.k or (i0 == 0 and i1 == NE - 1 and j0 == 0 and j1 == NL - 1):
                    v = self._box(self.S, i0, i1, j0, j1) / n if n else self.mean
                    break
                a += 1
            self.cache[key] = v
        return v

    def table(self):
        # The stored table is the dense prediction over the cells that have any training ball nearby.
        rows = []
        for i in range(NE):
            r = [mill(self.predict(i, j + LA_MIN)) for j in range(NL)]
            rows.append(r)
        return {'mean': mill(self.mean), 'rows': rows}


def evaluate(model, test):
    errs = [abs(model.predict(ev, la) - y) for ev, la, y in test]
    n = len(errs)
    sq = sum(e * e for e in errs)
    return {'n': n, 'mae': sum(errs) / n, 'rmse': math.sqrt(sq / n),
            'w02': sum(1 for e in errs if e <= 0.02) / n, 'w05': sum(1 for e in errs if e <= 0.05) / n}


def cv(factory, data, folds=10, seed=7):
    """K-fold cross-validation. Returns pooled metrics over all held-out balls."""
    import random
    idx = list(range(len(data)))
    random.Random(seed).shuffle(idx)
    errs = []
    for f in range(folds):
        test = [data[i] for k, i in enumerate(idx) if k % folds == f]
        train = [data[i] for k, i in enumerate(idx) if k % folds != f]
        m = factory(train)
        errs.extend(abs(m.predict(ev, la) - y) for ev, la, y in test)
    n = len(errs)
    return {'n': n, 'mae': sum(errs) / n, 'rmse': math.sqrt(sum(e * e for e in errs) / n),
            'w02': sum(1 for e in errs if e <= 0.02) / n, 'w05': sum(1 for e in errs if e <= 0.05) / n}


class KnnFine:
    """Like KnnBox, on a finer grid: `res` cells per mph (10 = 0.1 mph), 1 degree per cell.
    The box grows by (se cells, sl degrees) a step until it holds at least k training balls. Mean of the box."""
    def __init__(self, train, k=5, res=10, se=1, sl=1):
        self.k, self.res, self.se, self.sl = k, res, se, sl
        self.ne = EV_MAX * res + 1
        self.mean = sum(y for _, _, y in train) / len(train)
        ne, nl = self.ne, NL
        cnt = {}
        for ev, la, y in train:
            key = (self._i(ev), cj(la))
            a = cnt.setdefault(key, [0, 0.0])
            a[0] += 1
            a[1] += y
        self.C = [[0.0] * (nl + 1) for _ in range(ne + 1)]
        self.S = [[0.0] * (nl + 1) for _ in range(ne + 1)]
        grid_c = [[0.0] * nl for _ in range(ne)]
        grid_s = [[0.0] * nl for _ in range(ne)]
        for (i, j), (n, sm) in cnt.items():
            grid_c[i][j] = n
            grid_s[i][j] = sm
        for i in range(ne):
            rc = rs = 0.0
            gc, gs = grid_c[i], grid_s[i]
            for j in range(nl):
                rc += gc[j]
                rs += gs[j]
                self.C[i + 1][j + 1] = self.C[i][j + 1] + rc
                self.S[i + 1][j + 1] = self.S[i][j + 1] + rs

    def _i(self, ev):
        return min(max(int(round(ev * self.res)), 0), self.ne - 1)

    def predict(self, ev, la):
        i, j = self._i(ev), cj(la)
        C, S = self.C, self.S
        a = 0
        while True:
            i0, i1 = max(0, i - a * self.se), min(self.ne - 1, i + a * self.se)
            j0, j1 = max(0, j - a * self.sl), min(NL - 1, j + a * self.sl)
            n = C[i1 + 1][j1 + 1] - C[i0][j1 + 1] - C[i1 + 1][j0] + C[i0][j0]
            if n >= self.k or (i0 == 0 and i1 == self.ne - 1 and j0 == 0 and j1 == NL - 1):
                return (S[i1 + 1][j1 + 1] - S[i0][j1 + 1] - S[i1 + 1][j0] + S[i0][j0]) / n if n else self.mean
            a += 1

    def table(self):
        # Dense prediction over every cell. Only sensible for res <= 2; a finer grid is an accuracy ceiling, not a shippable table.
        if self.res > 2:
            raise NotImplementedError('KnnFine with res > 2 has no compact table')
        return {'mean': mill(self.mean), 'res': self.res,
                'rows': [[mill(self.predict(i / self.res, j + LA_MIN)) for j in range(NL)] for i in range(self.ne)]}
