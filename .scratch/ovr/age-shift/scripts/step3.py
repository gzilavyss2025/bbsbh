import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import numpy as np, sys
OUT={}
def design_bt(rec, ts):
    n=len(rec); B=np.zeros((n,9)); 
    for i,r in enumerate(rec): B[i,band(r[2])]=1
    T=np.zeros((n,len(ts)-1))
    for i,r in enumerate(rec):
        j=ts.index(r[1])
        if j>0: T[i,j-1]=1
    pc=np.array([(r[3]-50)/25 for r in rec])
    return B,T,pc
TS=[2015,2016,2017,2018,2019,2021,2022,2023,2024]
def analyse(role,m):
    rec=pairs(role,m); n=len(rec)
    B,T,pc=design_bt(rec,TS)
    present=np.array([r[4] for r in rec]); p=np.array([r[3] for r in rec]); onboard=np.array([r[5] for r in rec])
    bidx=np.array([band(r[2]) for r in rec])
    o={}
    # (a)/(e) attrition tables
    bandrows=[]
    for b in range(9):
        mk=bidx==b
        bandrows.append({'band':BANDS[b],'at_risk':int(mk.sum()),'p_present':float(present[mk].mean()),'p_onboard':float(onboard[mk].mean()),
          'mean_p_stayers':float(p[mk&(present==1)].mean()) if (mk&(present==1)).any() else None,
          'mean_p_leavers':float(p[mk&(present==0)].mean()) if (mk&(present==0)).any() else None})
    o['attr_by_band']=bandrows
    pb=[(0,25),(25,50),(50,75),(75,101)]
    o['attr_by_p']=[{'p_range':f'{a}-{b}','at_risk':int(((p>=a)&(p<b)).sum()),'p_present':float(present[(p>=a)&(p<b)].mean()),'p_onboard':float(onboard[(p>=a)&(p<b)].mean())} for a,b in pb]
    o['attr_overall']={'at_risk':n,'present':float(present.mean()),'onboard':float(onboard.mean()),'onboard_not_metric':float((onboard&(1-present)).mean()),'not_onboard':float(1-onboard.mean())}
    # logistic (c)
    X=np.hstack([B,pc[:,None],(pc**2)[:,None],T])
    bl=logit(X,present.astype(float)); ph=1/(1+np.exp(-X@bl))
    o['logit_p_coef']=[float(bl[9]),float(bl[10])]
    # delta data
    st=present==1
    d=np.array([r[6]-r[3] if r[4] else 0 for r in rec])
    w=1/np.clip(ph,0.02,1)
    o['ipw_wmax']=float(w[st].max()); o['ipw_wmean']=float(w[st].mean())
    ipw=[]; raw=[]
    for b in range(9):
        mk=st&(bidx==b); nn=int(mk.sum())
        mr=d[mk].mean(); ser=d[mk].std(ddof=1)/np.sqrt(nn)
        mi=(w[mk]*d[mk]).sum()/w[mk].sum(); sei=np.sqrt(((w[mk]*(d[mk]-mi))**2).sum())/w[mk].sum()
        ipw.append({'band':BANDS[b],'n':nn,'raw':float(mr),'raw_se':float(ser),'ipw':float(mi),'ipw_se':float(sei),'thin':nn<30})
    o['table']=ipw
    # (b) regression, stayers
    Bs,Ts,pcs=B[st],T[st],pc[st]; ds=d[st]; ws=w[st]
    def fit(Xm,wt=None):
        return ols(Xm,ds,wt)
    # additive M1
    X1=np.hstack([Bs,pcs[:,None],(pcs**2)[:,None],Ts])
    for tag,wt in (('ols',None),('ipw',ws)):
        beta,cov=fit(X1,wt)
        cb=beta[:9]; nb=Bs.sum(0)
        cen=cb-(cb*nb).sum()/nb.sum()
        o['M1_'+tag]={'band_coef':cb.tolist(),'band_se':np.sqrt(np.diag(cov)[:9]).tolist(),'centered':cen.tolist(),'p_lin':float(beta[9]),'p_sq':float(beta[10]),'p_lin_se':float(np.sqrt(cov[9,9]))}
    # interaction M2
    X2=np.hstack([Bs,Bs*pcs[:,None],(pcs**2)[:,None],Ts])
    ymean=Ts.mean(0)
    for tag,wt in (('ols',None),('ipw',ws)):
        beta,cov=fit(X2,wt)
        pred={}
        for P in (50,75):
            pq=(P-50)/25; row=[]
            for b in range(9):
                x=np.zeros(X2.shape[1]); x[b]=1; x[9+b]=pq; x[18]=pq*pq; x[19:]=ymean
                row.append({'band':BANDS[b],'pred':float(x@beta),'se':float(np.sqrt(x@cov@x))})
            pred[str(P)]=row
        o['M2_'+tag]=pred
    # (d) pool composition
    allp_t=p.mean(); 
    ent=[r for y in TS+[2025] for r in []]
    o['pool']={'mean_p_all_at_t':float(allp_t),'mean_p_stayers_at_t':float(p[st].mean()),'mean_p_stayers_at_t1':float(np.mean([r[6] for r in rec if r[4]])),
       'mean_delta_stayers':float(d[st].mean()),'mean_delta_ipw':float((w[st]*d[st]).sum()/w[st].sum())}
    # entrants: players with metric in t+1 who had no metric in t
    ents=[]; allt1=[]
    for t in TS:
        t1=t+1
        for pid,row in R[role][t1].items():
            if row[m] is None: continue
            allt1.append(row[m])
            prev=R[role][t].get(pid)
            if prev is None or prev[m] is None: ents.append(row[m])
    o['pool']['mean_p_entrants_t1']=float(np.mean(ents)); o['pool']['n_entrants']=len(ents); o['pool']['mean_p_all_t1']=float(np.mean(allt1))
    return o
if __name__=='__main__':
    for role in COLS:
        for m in COLS[role]:
            OUT[f'{role}|{m}']=analyse(role,m)
    json.dump(OUT,open(S+'/out_step3.json','w'),indent=1)
    for k,o in OUT.items():
        print('==',k,'overall',{a:round(b,3) for a,b in o['attr_overall'].items()})
        print(' present by band',[round(x['p_present'],2) for x in o['attr_by_band']])
        print(' present by p   ',[round(x['p_present'],2) for x in o['attr_by_p']])
        print(' leavers-stayers p by band',[round(x['mean_p_leavers']-x['mean_p_stayers'],1) if x['mean_p_leavers'] is not None and x['mean_p_stayers'] is not None else None for x in o['attr_by_band']])
        print(' raw ',[round(x['raw'],1) for x in o['table']])
        print(' ipw ',[round(x['ipw'],1) for x in o['table']], 'wmax',round(o['ipw_wmax'],1))
        print(' M1ipw centered',[round(x,1) for x in o['M1_ipw']['centered']],'plin',round(o['M1_ipw']['p_lin'],2),'psq',round(o['M1_ipw']['p_sq'],2))
        print(' M1ols centered',[round(x,1) for x in o['M1_ols']['centered']])
        print(' M2ipw@50',[round(x['pred'],1) for x in o['M2_ipw']['50']],'@75',[round(x['pred'],1) for x in o['M2_ipw']['75']])
        print(' pool',{a:round(b,2) for a,b in o['pool'].items()})
