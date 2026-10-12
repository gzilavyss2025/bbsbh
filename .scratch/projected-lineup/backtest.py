# Backtest for a projected lineup (spec.md in this folder). For every 2026
# regular-season MLB team-game from 07-01 to 09-27 with a posted nine, project
# the nine from the club's EARLIER games only, then count how many names and
# how many batting-order slots match the real lineup.
#
# Run from the repo root:  python3 -I .scratch/projected-lineup/backtest.py
# Result recorded 2026-10-12 (2,266 team-games):
#   A_last                  names 6.79/9  slots 4.14/9  exact 0.04  8+ names 0.28
#   B_same_hand             names 7.30/9  slots 4.84/9  exact 0.07  8+ names 0.44
#   C_usual_nine_same_hand  names 7.23/9  slots 3.96/9  exact 0.03  8+ names 0.42
# Caveat: "same hand" uses the OPPOSING PROBABLE pitcher's hand, which is not
# always the pitcher who started. Two requests: one schedule, one people batch.
import json, urllib.request, collections
U="https://statsapi.mlb.com/api/v1"
def get(u): return json.load(urllib.request.urlopen(u))
d=get(f"{U}/schedule?sportId=1&gameType=R&startDate=2026-07-01&endDate=2026-09-27&hydrate=lineups,probablePitcher")
games=[]
pids=set()
for dt in d['dates']:
  for g in dt['games']:
    if g['status']['abstractGameState']!='Final': continue
    L=g.get('lineups',{})
    for side,opp,key in (('home','away','homePlayers'),('away','home','awayPlayers')):
      lu=[p['id'] for p in L.get(key,[])]
      if len(lu)<9: continue
      sp=g['teams'][opp].get('probablePitcher',{}).get('id')
      if sp: pids.add(sp)
      games.append(dict(t=g['teams'][side]['team']['id'],d=g['gameDate'],pk=g['gamePk'],lu=lu[:9],sp=sp))
hand={}
pl=list(pids)
for i in range(0,len(pl),150):
  for p in get(f"{U}/people?personIds={','.join(map(str,pl[i:i+150]))}")['people']:
    hand[p['id']]=p.get('pitchHand',{}).get('code')
games.sort(key=lambda x:(x['d'],x['pk']))
byteam=collections.defaultdict(list)
res=collections.defaultdict(lambda:[0,0,0,0,0])  # n, names overlap sum, exact order, 8+ names
for g in games:
  prev=byteam[g['t']]
  h=hand.get(g['sp'])
  cands={'A_last':prev[-1]['lu'] if prev else None}
  same=[p for p in prev if hand.get(p['sp'])==h and h]
  cands['B_same_hand']=same[-1]['lu'] if same else (prev[-1]['lu'] if prev else None)
  pool=[p for p in prev if hand.get(p['sp'])==h][-10:] if h else []
  if len(pool)>=3:
    cnt=collections.Counter(); slot=collections.defaultdict(list)
    for p in pool:
      for i,x in enumerate(p['lu']): cnt[x]+=1; slot[x].append(i)
    top=[x for x,_ in cnt.most_common(9)]
    top.sort(key=lambda x: sorted(slot[x])[len(slot[x])//2])
    cands['C_usual_nine_same_hand']=top
  else: cands['C_usual_nine_same_hand']=cands['B_same_hand']
  if len(prev)>=1:
    for name,c in cands.items():
      if c is None: continue
      r=res[name]; r[0]+=1; ov=len(set(c)&set(g['lu'])); r[1]+=ov; r[2]+= c==g['lu']; r[3]+= ov>=8; r[4]+=sum(a==b for a,b in zip(c,g['lu']))
  prev.append(g)
for k,(n,ov,ex,e8,sl) in res.items():
  print(k, 'games',n,'names %.2f/9'%(ov/n),'slots %.2f/9'%(sl/n),'exact %.2f'%(ex/n),'8+ names %.2f'%(e8/n))
print('team-games',len(games),'hands known',sum(1 for g in games if hand.get(g['sp'])))
