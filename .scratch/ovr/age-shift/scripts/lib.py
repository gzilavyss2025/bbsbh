import csv, glob, json, os, numpy as np
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = {
 'bat': {'xwoba':'xwoba','ev':'exit_velocity','hardHit':'hard_hit_percent','brl':'brl_percent','chase':'chase_percent','sprintSpeed':'sprint_speed'},
 'pit': {'xera':'xera','k':'k_percent','bb':'bb_percent','whiff':'whiff_percent','chase':'chase_percent','fbVelo':'fb_velocity','hardHit':'hard_hit_percent'},
}
FILE = {'bat':'batter','pit':'pitcher'}
BANDS = ['<=22','23-24','25-26','27-28','29-30','31-32','33-34','35-36','37+']
MID = [21,23.5,25.5,27.5,29.5,31.5,33.5,35.5,38]
def band(a):
    if a<=22: return 0
    if a>=37: return 8
    return (a-23)//2+1
BIRTH = json.load(open(S+'/cache/birth.json'))
def ages(pid, year):
    b = BIRTH[pid]; y,m,d = map(int,b.split('-'))
    return year-y, year-y-(1 if (m,d)>(7,1) else 0)   # (season-birthyear, age on July 1)
def load():
    R = {}
    for role in COLS:
        R[role] = {}
        for yr in range(2015,2026):
            rows = {}
            for r in csv.DictReader(open(f'{S}/cache/{FILE[role]}-{yr}.csv',encoding='utf-8-sig')):
                rows[r['player_id']] = {k:(float(r[c]) if r[c]!='' else None) for k,c in COLS[role].items()}
            R[role][yr] = rows
    return R
def ols(X,y,w=None):
    if w is None: w=np.ones(len(y))
    sw=np.sqrt(w); Xw=X*sw[:,None]; yw=y*sw
    beta,*_=np.linalg.lstsq(Xw,yw,rcond=None)
    res=yw-Xw@beta; dof=max(len(y)-X.shape[1],1)
    s2=(res@res)/dof
    cov=s2*np.linalg.pinv(Xw.T@Xw)
    return beta,cov
def logit(X,y,iters=50,ridge=1e-6):
    b=np.zeros(X.shape[1])
    for _ in range(iters):
        eta=X@b; p=1/(1+np.exp(-eta)); W=p*(1-p)+1e-9
        H=X.T@(X*W[:,None])+ridge*np.eye(X.shape[1]); g=X.T@(y-p)-ridge*b
        step=np.linalg.solve(H,g); b+=step
        if np.abs(step).max()<1e-8: break
    return b
def ranks(x):
    x=np.asarray(x); o=np.argsort(x,kind='mergesort'); r=np.empty(len(x)); r[o]=np.arange(len(x))
    # average ties
    xs=x[o]; i=0
    while i<len(x):
        j=i
        while j+1<len(x) and xs[j+1]==xs[i]: j+=1
        r[o[i:j+1]]=(i+j)/2; i=j+1
    return r
def spearman(a,b): return float(np.corrcoef(ranks(a),ranks(b))[0,1])
