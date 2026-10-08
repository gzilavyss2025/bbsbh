import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import numpy as np
O=json.load(open(S+'/out_step3b_oos2021.json'))
GOF={'xwoba':'hit_skill','ev':'hit_skill','hardHit':'hit_skill','brl':'hit_skill','chase':'hit_skill','sprintSpeed':'sprintSpeed','xera':'pit_skill','k':'pit_skill','bb':'pit_skill','whiff':'pit_skill','fbVelo':'fbVelo'}
def f(g,a): a=min(max(a,20),40); return O[g]['quad_ipw']['fit'][a-20]
out={}
for role,ms in (('bat',['sprintSpeed','xwoba','ev','hardHit','brl','chase']),('pit',['fbVelo','xera','k','bb','whiff'])):
  for m in ms:
    ids=[p for p in R[role][2025] if all(p in R[role][y] and R[role][y][p][m] is not None for y in (2023,2024,2025))]
    y=[];b=[];s=[]
    for p in ids:
        a24=2024-int(BIRTH[p][:4]); g=GOF[m]
        p23=R[role][2023][p][m]; p24=R[role][2024][p][m]
        base=(4*p24+3*p23)/7                      # predict 2025 from 2024/2023, 4:3
        shift=(4*(p24+f(g,a24))+3*(p23+f(g,a24-1)+f(g,a24)))/7
        y.append(R[role][2025][p][m]); b.append(base); s.append(shift)
    y,b,s=map(np.array,(y,b,s))
    # error vs actual 2025; also with common mean-offset removed (rank-relevant)
    e0=y-b; e1=y-s
    out[f'{role}|{m}']={'n':len(ids),'rmse_base':float(np.sqrt((e0**2).mean())),'rmse_shift':float(np.sqrt((e1**2).mean())),
      'bias_base':float(e0.mean()),'bias_shift':float(e1.mean()),'rmse_base_demeaned':float(e0.std()),'rmse_shift_demeaned':float(e1.std()),
      'spearman_base_vs_actual':spearman(y,b),'spearman_shift_vs_actual':spearman(y,s)}
    print(m,{a:(round(c,3) if isinstance(c,float) else c) for a,c in out[f'{role}|{m}'].items()})
json.dump(out,open(S+'/out_step5b_holdout.json','w'),indent=1)
