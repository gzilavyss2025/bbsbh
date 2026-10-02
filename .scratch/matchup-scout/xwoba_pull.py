"""Pull Savant search rows, one day per request, into a cache under /tmp (#1411 Part C spike).

Usage:  python3 xwoba_pull.py START END      (dates inclusive, YYYY-MM-DD)
Run it as a background job. It resumes: a day that has a cache file is skipped.
Cache: /tmp/xwoba-cache/YYYY-MM-DD.csv.gz  (raw CSV text, gzip). Never commit it.

Rules from the task:
- One request at a time, 1 s pause, 3 tries per day.
- The cap check: a day must return fewer than 25,000 rows. Savant truncates silently at exactly 25,000.
- Stop rule: 3 days in a row that fail all 3 tries stop the run. The days missing go to MISSING.txt.
"""
import csv, datetime as dt, gzip, io, os, sys, time, urllib.parse
from h import SAV, ALLGT, curl

CACHE = '/tmp/xwoba-cache'
os.makedirs(CACHE, exist_ok=True)


def url_for(day):
    params = [('game_date_gt', day), ('game_date_lt', day), ('hfGT', ALLGT), ('player_type', 'pitcher')]
    return SAV + urllib.parse.urlencode(params, safe='|')


def log(msg):
    line = f'{time.strftime("%H:%M:%S")} {msg}'
    print(line, flush=True)


def fetch_day(day):
    last = ''
    for attempt in range(3):
        body, meta, secs, err = curl(url_for(day), 240)
        text = body.decode('utf-8-sig', errors='replace')
        if meta.startswith('200') and text.lstrip().startswith('"pitch_type"'):
            nrows = sum(1 for _ in csv.DictReader(io.StringIO(text)))
            if nrows >= 25000:
                raise SystemExit(f'{day}: {nrows} rows hit the 25,000 cap')
            return text, nrows, secs
        last = f'{meta} {err[:80]} {text[:80]!r}'
        log(f'{day} try {attempt + 1} failed: {last}')
        time.sleep(5 * (attempt + 1))
    return None, 0, last


def main(start, end):
    d = dt.date.fromisoformat(start)
    stop = dt.date.fromisoformat(end)
    streak = 0
    missing = []
    while d <= stop:
        day = d.isoformat()
        path = f'{CACHE}/{day}.csv.gz'
        if not os.path.exists(path):
            text, nrows, info = fetch_day(day)
            if text is None:
                missing.append(day)
                streak += 1
                log(f'{day} MISSING (streak {streak})')
                if streak >= 3:
                    log('STOP RULE: 3 failed days in a row')
                    break
            else:
                streak = 0
                with gzip.open(path + '.tmp', 'wt', encoding='utf-8') as fh:
                    fh.write(text)
                os.rename(path + '.tmp', path)
                log(f'{day} rows={nrows} {info:.1f}s')
            time.sleep(1)
        d += dt.timedelta(days=1)
    with open(f'{CACHE}/MISSING-{start}.txt', 'w') as fh:
        fh.write('\n'.join(missing))
    log(f'done {start}..{end}; missing={missing}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
