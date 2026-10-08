import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import step3b, numpy as np
A=json.load(open(S+'/out_step3b.json')); out={}
for g,(role,ms) in step3b.GROUPS.items():
    Xs,y,w,cl,ages,k=step3b.stack(role,ms,True,1,2024)
    X,B=step3b.build(Xs,k,'band',ages); beta,cov=step3b.cluster_ols(X,y,w,cl)
    cb=beta[:9]; nb=B.sum(0); cen=cb-(cb*nb).sum()/nb.sum()
    a=np.array(A[g]['band_ipw']['centered']); out[g]={'jul1_centered':cen.tolist(),'yearonly_centered':a.tolist(),'max_abs_diff':float(np.abs(cen-a).max())}
    print(g,[round(x,1) for x in cen],'max diff',round(np.abs(cen-a).max(),2))
json.dump(out,open(S+'/out_agedef.json','w'),indent=1)
