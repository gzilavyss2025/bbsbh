import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
R = load()
def pairs(role, metric, include2020=False, agedef=0, tmax=2024):
    """one record per (pid,t) with metric at t; present=metric at t+1 exists."""
    out=[]
    for t in range(2015,tmax+1):
        if not include2020 and (t==2020 or t+1==2020): continue
        for pid,row in R[role][t].items():
            p=row[metric]
            if p is None: continue
            nx=R[role][t+1].get(pid)
            onboard = nx is not None
            pn = nx[metric] if nx else None
            out.append((pid,t,ages(pid,t)[agedef],p,1 if pn is not None else 0,1 if onboard else 0,pn))
    return out
