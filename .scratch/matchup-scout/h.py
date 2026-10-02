"""Shared helpers for the Matchup Scout probes (#1408). Python 3.11 standard library plus `curl`.

Every probe imports this file, so run a probe from this folder:  python3 probe_frame.py

- curl(url)      GET with curl. Returns (body bytes, "HTTP code + byte count", seconds, stderr).
- jget(path)     GET one statsapi path and parse the JSON.
- savant(params) GET Savant's statcast_search CSV. `params` is a dict. A list value becomes
                 repeated `key[]=` entries (batters_lookup, pitchers_lookup).
                 Returns (rows, bytes, seconds, meta, first 200 characters).

Savant notes that cost time to learn (verified 2026-10-02):
- The bounds game_date_gt and game_date_lt are INCLUSIVE.
- A request that matches more than 25,000 rows returns exactly 25,000, with no error. It keeps the NEWEST rows.
- Savant sometimes refuses a cold connection. savant() retries.
"""
import csv
import io
import json
import subprocess
import time
import urllib.parse

SAV = 'https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&'
# Regular season plus every postseason round: wild card, division series, league championship series, World Series.
ALLGT = 'R|F|D|L|W|'


def curl(url, timeout=180):
    started = time.time()
    p = subprocess.run(
        ['curl', '-sS', '-m', str(timeout), '-L', '-w', '\n__HTTP=%{http_code} __BYTES=%{size_download}', url],
        capture_output=True,
    )
    body, _, meta = p.stdout.rpartition(b'\n__HTTP=')
    return body, meta.decode(), time.time() - started, p.stderr.decode()


def jget(path):
    body, meta, _, err = curl('https://statsapi.mlb.com' + path)
    try:
        return json.loads(body)
    except ValueError:
        raise RuntimeError(f'bad json for {path}: {meta} {err} {body[:200]!r}')


def savant(params, timeout=240, tries=3):
    pairs = []
    for key, value in params.items():
        if isinstance(value, list):
            pairs.extend((key + '[]', item) for item in value)
        else:
            pairs.append((key, value))
    url = SAV + urllib.parse.urlencode(pairs, safe='|')
    for attempt in range(tries):
        body, meta, secs, _ = curl(url, timeout)
        if body.strip() and meta.startswith('200'):
            break
        time.sleep(3 * (attempt + 1))
    text = body.decode('utf-8-sig', errors='replace')
    rows = list(csv.DictReader(io.StringIO(text))) if text.lstrip().startswith('"') else []
    return rows, len(body), secs, meta, text[:200]
