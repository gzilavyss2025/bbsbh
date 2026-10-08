import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import numpy as np
res={}; 
def table(rec):
    cells=[]
    for b in range(9):
        d=np.array([r[6]-r[3] for r in rec if r[4] and band(r[2])==b])
        n=len(d); cells.append({'band':BANDS[b],'n':n,'mean':float(d.mean()) if n else None,'se':float(d.std(ddof=1)/np.sqrt(n)) if n>1 else None,'thin':n<30})
    return cells
for role in COLS:
    for m in COLS[role]:
        for inc in (False,True):
            for ad in (0,1):
                rec=pairs(role,m,inc,ad)
                res[f'{role}|{m}|{"with2020" if inc else "main"}|{"jul1" if ad else "yearonly"}']=table(rec)
json.dump(res,open(S+'/out_step2_raw.json','w'))
def show(k):
    print(k, ' '.join(f"{c['mean']:+.1f}({c['n']}{'*' if c['thin'] else ''})" if c['mean'] is not None else 'NA' for c in res[k]))
for role in COLS:
    for m in COLS[role]: show(f'{role}|{m}|main|yearonly')
print('--- with 2020'); 
for role in COLS:
    for m in COLS[role]: show(f'{role}|{m}|with2020|yearonly')
# age definition effect
print('--- jul1 vs year-only: max abs cell diff (cells n>=30 both), share of players moved band')
for role in COLS:
    for m in COLS[role]:
        a=res[f'{role}|{m}|main|yearonly']; b=res[f'{role}|{m}|main|jul1']
        diffs=[abs(x['mean']-y['mean']) for x,y in zip(a,b) if not x['thin'] and not y['thin']]
        r0=pairs(role,m,False,0); r1=pairs(role,m,False,1)
        moved=np.mean([band(x[2])!=band(y[2]) for x,y in zip(r0,r1)])
        print(role,m,f'maxdiff={max(diffs):.2f} moved={moved:.2f}')
