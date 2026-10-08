import csv,glob,subprocess,json,os,io
S=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ids=set()
for f in glob.glob(S+'/cache/*-20*.csv'):
    for r in csv.DictReader(open(f,encoding='utf-8-sig')): ids.add(r['player_id'])
ids=sorted(ids); print(len(ids))
out={}
for i in range(0,len(ids),800):
    ch=ids[i:i+800]
    u='https://statsapi.mlb.com/api/v1/people?personIds=%s&fields=people,id,birthDate'%','.join(ch)
    r=subprocess.run(['curl','-sS','-m','120',u],capture_output=True,text=True).stdout
    for p in json.loads(r)['people']:
        if 'birthDate' in p: out[str(p['id'])]=p['birthDate']
json.dump(out,open(S+'/cache/birth.json','w'))
print(len(out))
