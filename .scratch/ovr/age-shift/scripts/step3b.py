import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
from step3 import design_bt, TS
import numpy as np
GROUPS={'hit_skill':('bat',['xwoba','ev','hardHit','brl','chase']),'sprintSpeed':('bat',['sprintSpeed']),
        'pit_skill':('pit',['xera','k','bb','whiff','chase','hardHit']),'fbVelo':('pit',['fbVelo'])}
def prep(role,m,agedef=0,tmax=2024):
    rec=pairs(role,m,False,agedef,tmax)
    B,T,pc=design_bt(rec,TS)
    present=np.array([r[4] for r in rec],float)
    X=np.hstack([B,pc[:,None],(pc**2)[:,None],T]); bl=logit(X,present); ph=1/(1+np.exp(-X@bl))
    w=1/np.clip(ph,0.02,1)
    st=present==1
    d=np.array([r[6]-r[3] if r[4] else 0 for r in rec])
    return dict(rec=[r for r,s in zip(rec,st) if s],B=B[st],T=T[st],pc=pc[st],d=d[st],w=w[st],
                age=np.array([r[2] for r in rec])[st],pid=np.array([r[0] for r in rec])[st],t=np.array([r[1] for r in rec])[st])
def cluster_ols(X,y,w,cl):
    sw=np.sqrt(w); Xw=X*sw[:,None]; yw=y*sw
    beta,*_=np.linalg.lstsq(Xw,yw,rcond=None)
    e=yw-Xw@beta; XtX_inv=np.linalg.pinv(Xw.T@Xw)
    ids,inv=np.unique(cl,return_inverse=True)
    meat=np.zeros((X.shape[1],X.shape[1]))
    sc=np.zeros((len(ids),X.shape[1])); np.add.at(sc,inv,Xw*e[:,None])
    meat=sc.T@sc
    G=len(ids); cov=XtX_inv@meat@XtX_inv*G/(G-1)
    return beta,cov
def stack(role,ms,weighted=True,agedef=0,tmax=2024):
    parts=[prep(role,m,agedef,tmax) for m in ms]
    k=len(ms)
    rows=[];
    Xs=[];ys=[];ws=[];cl=[];ages=[]
    for j,P in enumerate(parts):
        n=len(P['d']); M=np.zeros((n,k)); M[:,j]=1
        Xs.append(dict(M=M,pc=P['pc'],T=P['T'],B=P['B'])); ys.append(P['d']); ws.append(P['w'] if weighted else np.ones(n)); cl.append(P['pid']); ages.append(P['age'])
    return Xs,np.concatenate(ys),np.concatenate(ws),np.concatenate(cl),np.concatenate(ages),k
def build(Xs,k,mode,ages):
    cols=[]
    M=np.vstack([x['M'] for x in Xs]); pc=np.concatenate([x['pc'] for x in Xs]); T=np.vstack([x['T'] for x in Xs])
    B=np.vstack([x['B'] for x in Xs])
    a=(ages-27)/5
    base=[M,M*pc[:,None],M*(pc**2)[:,None],T]
    if mode=='band': return np.hstack([B]+base[1:]+[]) , B   # band dummies carry intercept; metric intercepts dropped
    if mode=='quad': return np.hstack(base+[a[:,None],(a**2)[:,None]]),None
    if mode=='cubic': return np.hstack(base+[a[:,None],(a**2)[:,None],(a**3)[:,None]]),None
def run(tmax=2024,modes_w=(True,False)):
    out={}
    for g,(role,ms) in GROUPS.items():
        o={}
        for weighted in modes_w:
            Xs,y,w,cl,ages,k=stack(role,ms,weighted,0,tmax)
            # band model (pooled, centered)
            X,B=build(Xs,k,'band',ages)
            beta,cov=cluster_ols(X,y,w,cl)
            cb=beta[:9]; nb=B.sum(0); C=np.eye(9)-np.outer(np.ones(9),nb/nb.sum())   # centering operator
            cen=C@cb; cse=np.sqrt(np.diag(C@cov[:9,:9]@C.T))
            o['band_'+('ipw' if weighted else 'ols')]={'centered':cen.tolist(),'se':cse.tolist(),'n':nb.tolist()}
            # quad / cubic
            for mode in ('quad','cubic'):
                X,_=build(Xs,k,mode,ages); beta,cov=cluster_ols(X,y,w,cl)
                npoly=2 if mode=='quad' else 3
                coef=beta[-npoly:]; cv=cov[-npoly:,-npoly:]
                grid=np.arange(20,41)
                def F(a):
                    z=(a-27)/5; return np.array([z**(i+1) for i in range(npoly)])
                mean_basis=np.mean([F(a) for a in ages],axis=0)   # sample-mean centering (stacked rows)
                fit=[];se=[]
                for a in grid:
                    v=F(a)-mean_basis; fit.append(float(v@coef)); se.append(float(np.sqrt(v@cv@v)))
                o[mode+('_ipw' if weighted else '_ols')]={'ages':grid.tolist(),'fit':fit,'se':se,'coef':coef.tolist()}
        out[g]=o
    return out
if __name__=='__main__':
    out=run(); json.dump(out,open(S+'/out_step3b.json','w'),indent=1)
    for g,o in out.items():
        print('==',g)
        print(' band ipw cen',[round(x,1) for x in o['band_ipw']['centered']],'se',[round(x,1) for x in o['band_ipw']['se']])
        print(' band ols cen',[round(x,1) for x in o['band_ols']['centered']])
        for k in ('quad_ipw','cubic_ipw'):
            print(' ',k,'age20..40 step2',[round(o[k]['fit'][i],1) for i in range(0,21,2)],'se',[round(o[k]['se'][i],1) for i in range(0,21,4)])
