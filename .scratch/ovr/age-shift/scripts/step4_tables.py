import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import *
import numpy as np, csv
A=json.load(open(S+'/out_step3b.json')); O=json.load(open(S+'/out_step3.json')); RAW=json.load(open(S+'/out_step2_raw.json'))
import step3b
G=step3b.GROUPS
final={}
# pooled raw and IPW-only (no p control) tables per group, n-weighted over metrics, centered on stayer n-weighted mean
for g,(role,ms) in G.items():
    n=np.zeros(9); sr=np.zeros(9); si=np.zeros(9)
    for m in ms:
        for b,c in enumerate(O[f'{role}|{m}']['table']):
            n[b]+=c['n']; sr[b]+=c['n']*c['raw']; si[b]+=c['n']*c['ipw']
    raw=sr/n; ipw=si/n
    cr=raw-(raw*n).sum()/n.sum(); ci=ipw-(ipw*n).sum()/n.sum()
    final[g]={'bands':BANDS,'n_rows_all_metrics':n.tolist(),'raw_uncentered':raw.tolist(),'ipw_uncentered':ipw.tolist(),'raw_centered':cr.tolist(),'ipw_centered':ci.tolist(),
      'reg_centered_ols':A[g]['band_ols']['centered'],'final_adjusted':A[g]['band_ipw']['centered'],'final_adjusted_se':A[g]['band_ipw']['se'],
      'overall_stayer_mean_delta_raw':float((raw*n).sum()/n.sum()),
      'smooth_ages':A[g]['quad_ipw']['ages'],'smooth_quad':A[g]['quad_ipw']['fit'],'smooth_quad_se':A[g]['quad_ipw']['se'],'smooth_cubic':A[g]['cubic_ipw']['fit']}
    print(g); 
    for k in ('raw_uncentered','raw_centered','ipw_centered','reg_centered_ols','final_adjusted','final_adjusted_se'):
        print('  ',k,[round(x,1) for x in final[g][k]])
    print('   n',[int(x) for x in n], 'overall raw mean',round(final[g]['overall_stayer_mean_delta_raw'],2))
    # mean age of at-risk rows
    ag=np.concatenate([[r[2] for r in pairs(role,m) if r[4]] for m in ms]); final[g]['mean_age_stayer_rows']=float(ag.mean()); print('   mean age',round(ag.mean(),2))
json.dump(final,open(S+'/age-shift-tables.json','w'),indent=1)
with open(S+'/age-shift-tables.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['group','age_band','n_rows','raw_uncentered','raw_centered','ipw_centered','reg_centered_ols','final_adjusted','final_adjusted_se'])
    for g,d in final.items():
        for b in range(9): w.writerow([g,BANDS[b],int(d['n_rows_all_metrics'][b])]+[round(d[k][b],2) for k in ('raw_uncentered','raw_centered','ipw_centered','reg_centered_ols','final_adjusted','final_adjusted_se')])
with open(S+'/age-shift-smooth.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['group','age_at_t','shift_points_per_year_quad','se','cubic'])
    for g,d in final.items():
        for i,a in enumerate(d['smooth_ages']): w.writerow([g,a,round(d['smooth_quad'][i],2),round(d['smooth_quad_se'][i],2),round(d['smooth_cubic'][i],2)])
# per-metric long CSV
with open(S+'/age-shift-per-metric.csv','w',newline='') as f:
    w=csv.writer(f); w.writerow(['role','metric','age_band','n','raw_mean','raw_se','thin','ipw_mean','M1_ipw_centered','M2_ipw_at50','M2_ipw_at75','raw_with2020','raw_jul1'])
    for k,o in O.items():
        role,m=k.split('|')
        for b in range(9):
            c=o['table'][b]
            w.writerow([role,m,BANDS[b],c['n'],round(c['raw'],2),round(c['raw_se'],2),int(c['thin']),round(c['ipw'],2),round(o['M1_ipw']['centered'][b],2),round(o['M2_ipw']['50'][b]['pred'],2),round(o['M2_ipw']['75'][b]['pred'],2),
              (round(RAW[f'{role}|{m}|with2020|yearonly'][b]['mean'],2) if RAW[f'{role}|{m}|with2020|yearonly'][b]['mean'] is not None else ''),
              (round(RAW[f'{role}|{m}|main|jul1'][b]['mean'],2) if RAW[f'{role}|{m}|main|jul1'][b]['mean'] is not None else '')])
# step 4: WAR comparison for hit_skill (and sprint)
war={'20-24':0.50,'25-26':0.19,'27-28':-0.04,'29-30':-0.16,'31-32':-0.31,'35-36':-0.44}
def agg(g,key,bs):
    d=final[g]; n=np.array(d['n_rows_all_metrics']); v=np.array(d[key]); return float((n[bs]*v[bs]).sum()/n[bs].sum())
mp={'20-24':[0,1],'25-26':[2],'27-28':[3],'29-30':[4],'31-32':[5],'35-36':[7]}
xs=list(war.values())
for g in ('hit_skill','sprintSpeed'):
    for key in ('raw_uncentered','final_adjusted'):
        ys=[agg(g,key,mp[k]) for k in war]
        pr=np.corrcoef(xs,ys)[0,1]; 
        from lib import spearman
        print(g,key,[round(y,2) for y in ys],'pearson',round(pr,2),'spearman',round(spearman(xs,ys),2))
        final.setdefault('war_compare',{})[g+'|'+key]={'ours':ys,'war':xs,'pearson':float(pr),'spearman':float(spearman(xs,ys))}
# slopes pre/post for smooth fits
for g in final:
    if g=='war_compare': continue
    s=np.array(final[g]['smooth_quad']); ag=np.array(final[g]['smooth_ages'])
    pre=s[(ag>=21)&(ag<=28)].mean(); post=s[(ag>=30)&(ag<=37)].mean()
    z=[ag[i] for i in range(len(ag)-1) if s[i]>0>=s[i+1]]
    print(g,'mean shift ages21-28',round(pre,2),'ages30-37',round(post,2),'ratio',round(post/pre,2),'zero cross after',z)
    final[g]['pre_post']=[float(pre),float(post)]
json.dump(final,open(S+'/age-shift-tables.json','w'),indent=1)
