from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import textwrap,html
out=Path('.scratch/offseason-design');out.mkdir(parents=True,exist_ok=True)
PAPER='#F6EFDC';CARD='#FBF6E9';INK='#16222F';MUTED='#3C4A5A';RULE='#CBC1A7';SEAL='#DFC17D'
fonts=Path('C:/Windows/Fonts')
def font(n,bold=False,mono=False):
 p=fonts/('consola.ttf' if mono else 'arialbd.ttf' if bold else 'arial.ttf')
 return ImageFont.truetype(str(p),n)
class Board:
 def __init__(self,w,h):
  self.w=w;self.im=Image.new('RGB',(w,h),PAPER);self.d=ImageDraw.Draw(self.im)
 def box(self,x,y,w,h,fill=CARD,line=RULE):self.d.rectangle((x,y,x+w,y+h),fill=fill,outline=line,width=1)
 def text(self,x,y,t,n=16,b=False,c=INK,mono=False):self.d.text((x,y),t,font=font(n,b,mono),fill=c)
 def para(self,x,y,t,width,n=16,c=MUTED):
  words=t.split();lines=[];line=''
  for word in words:
   nxt=(line+' '+word).strip()
   if self.d.textlength(nxt,font=font(n))>width:lines.append(line);line=word
   else:line=nxt
  if line:lines.append(line)
  for l in lines:self.text(x,y,l,n,c=c);y+=n+7
  return y
 def button(self,x,y,w,t,primary=False):
  self.box(x,y,w,44,INK if primary else CARD,INK);self.text(x+12,y+12,t,15,True,PAPER if primary else INK)
 def rule(self,x,y,w):self.d.line((x,y,x+w,y),fill=RULE,width=1)
 def save(self,name):self.im.save(out/name)
def shell(b,letter,title):
 m=b.w<500;p=18 if m else 36;w=b.w-2*p
 b.text(p,16,f'{letter} / {title.upper()}',14,True)
 b.text(p,40,'ILLUSTRATIVE DATA · DESIGN STUDY',11,c=MUTED)
 b.rule(p,65,w);b.text(p,82,'TALLY',25,True)
 b.text(b.w-150,89,'Search   Log   Menu',12)
 y=126 if m else 84;x=p if m else 300
 for s in ['MLB','AAA','AA','A+','A']:
  b.box(x,y,52,35,INK if s=='A+' else PAPER,INK if s=='A+' else RULE)
  b.text(x+11,y+9,s,14,True,PAPER if s=='A+' else INK);x+=58
 y=181 if m else 138
 b.text(p,y,'BROWSE HIGH-A CLUBS',11,True,c=MUTED)
 x=p
 for s in (['WIS','BEL','CR','SB','QC','PEO'] if m else ['WIS','BEL','CR','SB','QC','PEO','WM','LAN','DAY','GL','FW','LC']):
  b.box(x,y+24,42,40);b.text(x+7,y+37,s,12,True);x+=52
 y+=83;b.rule(p,y,w)
 b.text(p,y+17,'‹   Mon, Oct 12, 2026   ›',17,True)
 if not m:b.text(650,y+19,'Browse a date',14)
 y+=61;b.rule(p,y,w)
 b.text(p,y+17,'HIGH-A · SEASON COMPLETE',13,True)
 b.text(p,y+41,'2026 season',26,True)
 b.text(p,y+76,'MLB and AAA keep their own daily slates.',12,c=MUTED)
 y+=111
 if not m:
  b.box(934,y,230,330);b.text(950,y+18,'ROSTER WIRE',18,True)
  b.para(950,y+53,'Existing current roster moves stay here. Links open player and team pages.',195,16)
  b.rule(950,y+176,195);b.text(950,y+195,'No recent moves?',14,True)
  b.para(950,y+222,'Omit the rail and return this width to the archive.',195,15)
 return p,y,(w if m else 862)
def card(b,x,y,w,kicker,title,body,cta):
 end=b.para(x+18,y+78,body,w-36,16)
 h=end-y+78;b.box(x,y,w,h)
 b.text(x+18,y+16,kicker,12,True,c=MUTED);b.text(x+18,y+41,title,24,True)
 b.para(x+18,y+78,body,w-36,16);b.button(x+18,end+13,min(w-36,260),cta,True)
 return y+h
for mobile in [False,True]:
 w=390 if mobile else 1200
 # A
 b=Board(w,1320 if mobile else 1030);x,y,cw=shell(b,'A','One more game')
 end=card(b,x,y,cw,'FROM THE 2026 ARCHIVE','One more game','Open a completed High-A game at the lineups, then reveal one at-bat at a time. The pick does not depend on the result.','Open a random game')
 b.text(x+18,end-4,'Existing reveal progress still applies.',12,c=MUTED)
 y=end+24
 if mobile:
  b.box(x,y,cw,165);b.text(x+18,y+18,'A PLAYER TO MEET',12,True);b.text(x+18,y+45,'Andrew Fischer',23,True)
  b.para(x+18,y+79,'Played at High-A in 2026. Opens his player overview with season stats.',cw-36,15)
  b.text(x+18,y+137,'Open player →     Another player',14,True);y+=190
 else:
  b.box(x,y,418,177);b.text(x+18,y+18,'A PLAYER TO MEET',12,True);b.text(x+18,y+45,'Andrew Fischer',23,True)
  b.para(x+18,y+81,'Played at High-A in 2026. Open his overview with season stats.',382,15);b.text(x+18,y+141,'Open player →     Another player',14,True)
  b.box(x+442,y,420,177);b.text(x+460,y+18,'SEASON RECORD',12,True);b.text(x+460,y+52,'Standings and postseason',22,True)
  b.para(x+460,y+88,'Results open on a separate page.',380,15);b.text(x+460,y+141,'Open season record →',15,True);y+=205
 if mobile:
  b.box(x,y,cw,124);b.text(x+18,y+18,'SEASON RECORD',12,True);b.para(x+18,y+45,'Standings and postseason. Opens results on a separate page.',cw-36,15);b.text(x+18,y+95,'Open season record →',15,True);y+=149
 b.rule(x,y,cw);b.para(x,y+17,'Why return: another game to score, another player to explore. No carousel. Picks change only when requested.',cw,15)
 b.text(x,b.im.height-52,'Mobile: roster wire docks below content.' if mobile else 'Priority: game → player → records. Keep results out of the archive invitation.',12,c=MUTED)
 b.save('a-mobile.png' if mobile else 'a-desktop.png')
 # B
 b=Board(w,1550 if mobile else 1320);x,y,cw=shell(b,'B','Season record')
 b.text(x,y,'Midwest League  v',24,True);b.text(x,y+36,'Also: Northwest · South Atlantic',13,c=MUTED);y+=73
 b.box(x,y,cw,82,SEAL,INK);b.text(x+16,y+14,'Season results',18,True)
 b.para(x+16,y+43,'Open standings and postseason results →',cw-32,15,INK);y+=101
 b.text(x,y,'AFTER OPENING THE SEASON RECORD',11,True,c=MUTED);y+=30
 b.box(x,y,cw,235);b.text(x+16,y+16,'Final standings · West',21,True)
 b.text(x+16,y+52,'Full season   |   First half   |   Second half',12,True)
 b.text(x+16,y+88,'Club',14,True);b.text(x+cw-140,y+88,'W     L     PCT',12,True,mono=True)
 for i,(name,nums) in enumerate([('Cedar Rapids','78   54   .591'),('Wisconsin','74   58   .561'),('Quad Cities','70   62   .530')]):
  yy=y+117+i*32;b.rule(x+16,yy-5,cw-32);b.text(x+16,yy,name,15);b.text(x+cw-140,yy,nums,12,mono=True)
 b.text(x+16,y+216,'Illustrative excerpt · View all six clubs →',11,c=MUTED);y+=260
 b.text(x,y,'POSTSEASON · MIDWEST',19,True);y+=35
 if mobile:
  for title,body in [('West division · best of 3','Wisconsin wins 2-1 vs Cedar Rapids'),('East division · best of 3','West Michigan wins 2-0 vs Lake County'),('League final · best of 3','West Michigan wins 2-1 vs Wisconsin')]:
   b.box(x,y,cw,83);b.text(x+14,y+13,title,16,True);b.text(x+14,y+42,body,14);y+=96
 else:
  for ox,oy,title,body in [(x,y,'West · best of 3','Wisconsin wins 2-1 vs Cedar Rapids'),(x,y+89,'East · best of 3','West Michigan wins 2-0 vs Lake County'),(x+478,y+42,'League final · best of 3','West Michigan wins 2-1 vs Wisconsin')]:
   b.box(ox,oy,365, seventy:=72);b.text(ox+14,oy+12,title,17,True);b.text(ox+14,oy+42,body,14)
  b.d.line([(x+365,y+36),(x+425,y+36),(x+425,y+78),(x+478,y+78)],fill=INK,width=2)
  b.d.line([(x+365,y+125),(x+425,y+125),(x+425,y+78)],fill=INK,width=2);y+=188
 b.para(x,y,'Illustrative pairings. Open a series for game dates and results. Northwest uses one best-of-five final.',cw,14);y+=73
 b.button(x,y,min(cw,310),'Score a random regular-season game');y+=68
 b.para(x,y,'The home invitation stays neutral. This lower panel sketches the separate record page after an explicit open.',cw,14)
 b.save('b-mobile.png' if mobile else 'b-desktop.png')
 # C
 b=Board(w,1450 if mobile else 1130);x,y,cw=shell(b,'C','Season notebook')
 end=card(b,x,y,cw,'SEASON NOTEBOOK · NOTE 01','The patient hitters','Which hitters walked in at least 15% of their plate appearances? A short report with a 250-PA minimum.','Read the season report')
 y=end+20;b.text(x,y,'Previous note    1 of 12    Next note',14,True);y+=43
 b.text(x,y,'AFTER OPENING THE REPORT',11,True,c=MUTED);y+=28
 b.box(x,y,cw,164);b.text(x+16,y+15,'18 walks per 100 plate appearances',17,True)
 b.para(x+16,y+49,'Sample hitter · 72 BB / 400 PA = 18.0%. Compare within the same league. This describes the season, not future talent.',cw-32,15)
 b.text(x+16,y+132,'Illustrative numbers · Open player stats →',12,True);y+=189
 if mobile:
  b.box(x,y,cw,137);b.text(x+16,y+16,'Explore another player',21,True);b.para(x+16,y+50,'A random 2026 High-A player. Opens an overview, not an at-bat.',cw-32,15);b.text(x+16,y+108,'Choose a player →',15,True);y+=161
  b.button(x,y,cw,'Open a random game',True);y+=68
 else:
  b.box(x,y,418,132);b.text(x+16,y+16,'Explore another player',21,True);b.para(x+16,y+51,'A 2026 High-A player. Opens an overview.',385,15);b.text(x+16,y+101,'Choose a player →',15,True)
  b.box(x+442,y,420,132);b.text(x+458,y+16,'Put pencil to paper',21,True);b.text(x+458,y+53,'Lineups, then one at-bat at a time.',15);b.text(x+458,y+101,'Open a random game →',15,True);y+=155
 b.text(x,y,'Season record →  Opens standings and results',13,True);y+=39
 b.para(x,y,'A new note may be suggested each day. The visible card never changes while you read. Next note is always available.',cw,15)
 b.save('c-mobile.png' if mobile else 'c-desktop.png')
print('Created six wireframe boards')
