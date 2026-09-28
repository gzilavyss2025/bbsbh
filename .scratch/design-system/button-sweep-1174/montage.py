from PIL import Image
import sys
names=['stampstrip-modes','logbook-seasons','scorecard-switch','flipback-toprow','flipback-watchbtn','salaries-band','house-band-winprob']
rows=[]
for n in names:
    a=Image.open(f'before/{n}.png'); b=Image.open(f'after/{n}.png')
    w=a.width+b.width+30; h=max(a.height,b.height)
    im=Image.new('RGB',(w,h+10),'white'); im.paste(a,(0,0)); im.paste(b,(a.width+30,0)); rows.append(im)
W=max(r.width for r in rows); H=sum(r.height for r in rows)
out=Image.new('RGB',(W,H),'#ddd'); y=0
for r in rows: out.paste(r,(0,y)); y+=r.height
out.thumbnail((1600,4000)); out.save('montage.png'); print(out.size)
