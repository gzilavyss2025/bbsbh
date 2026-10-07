import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import step3b, numpy as np
A = json.load(open(S+'/out_step3b.json'))
OOS = step3b.run(2021,(True,)); json.dump(OOS,open(S+'/out_step3b_oos2021.json','w'),indent=1)
RAW = json.load(open(S+'/out_step2_raw.json'))
GOF = {'xwoba':'hit_skill','ev':'hit_skill','hardHit':'hit_skill','brl':'hit_skill','chase':'hit_skill','sprintSpeed':'sprintSpeed',
       'xera':'pit_skill','k':'pit_skill','bb':'pit_skill','whiff':'pit_skill','fbVelo':'fbVelo'}
def pitchase(m): return m
def f_quad(src,g,a):
    d=src[g]['quad_ipw']; a=min(max(a,20),40); return d['fit'][a-20]
def f_raw(role,m,a):
    return RAW[f'{role}|{m}|main|yearonly'][band(a)]['mean']
def run(role,m,g):
    ids=[p for p in R[role][2025] if all(p in R[role][y] and R[role][y][p][m] is not None for y in (2023,2024,2025))]
    base=[];sh={'quad_all':[],'quad_oos2021':[],'naive_raw':[]}
    W={2025:5,2024:4,2023:3}
    for p in ids:
        A25=2025-int(BIRTH[p][:4])
        ps={y:R[role][y][p][m] for y in W}
        b=sum(W[y]*ps[y] for y in W)/12; base.append(b)
        for tag,fn in (('quad_all',lambda a:f_quad(A,g,a)),('quad_oos2021',lambda a:f_quad(OOS,g,a)),('naive_raw',lambda a:f_raw(role,m,a))):
            tot=0
            for y in W:
                ay=A25-(2025-y)
                tot+=W[y]*(ps[y]+sum(fn(a) for a in range(ay,A25)))
            sh[tag].append(tot/12)
    base=np.array(base); res={'n':len(ids)}
    for tag,v in sh.items():
        v=np.array(v); d=v-base
        res[tag]={'spearman':spearman(base,v),'mean_abs':float(np.abs(d).mean()),'max_abs':float(np.abs(d).max()),'gt3':int((np.abs(d)>3).sum()),'gt2':int((np.abs(d)>2).sum()),'mean_signed':float(d.mean())}
    return res
out={}
for role,ms in (('bat',['sprintSpeed','xwoba','ev','hardHit','brl','chase']),('pit',['fbVelo','xera','k','bb','whiff'])):
    for m in ms:
        out[f'{role}|{m}']=run(role,m,GOF[m])
json.dump(out,open(S+'/out_step5.json','w'),indent=1)
for k,v in out.items():
    print(k,'n=',v['n'])
    for tag in ('quad_all','quad_oos2021','naive_raw'):
        x=v[tag]; print('   ',tag,{a:(round(b,3) if isinstance(b,float) else b) for a,b in x.items()})
