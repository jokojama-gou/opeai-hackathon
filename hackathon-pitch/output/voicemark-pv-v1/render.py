"""Render the 120-second Voicemark concept PV locally; no external API calls.

Python packages: pillow, numpy, opencv-python, imageio-ffmpeg.
Usage: python render.py --preview | --render | --check
AI-generated images are immutable source footage for the video composition.
All UI/typography/motion/sound are authored here; this is not product footage.
"""
from pathlib import Path
from functools import lru_cache
import argparse, json, math, subprocess, wave
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
STORY = json.loads((ROOT / 'story.json').read_text(encoding='utf-8'))
W, H, FPS, DURATION = 1280, 720, 24, 120
INK = (25, 49, 42)
CREAM = (247, 246, 239)
SAGE = (185, 217, 174)
MUTED = (100, 117, 105)
ORANGE = (234, 112, 73)
WHITE = (255, 255, 251)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FONT = Path('C:/Windows/Fonts/YuGothM.ttc')
BOLD = Path('C:/Windows/Fonts/YuGothB.ttc')
EN = Path('C:/Windows/Fonts/arial.ttf')
ENB = Path('C:/Windows/Fonts/arialbd.ttf')

@lru_cache(maxsize=200)
def font(size, bold=False, latin=False):
    return ImageFont.truetype(str((ENB if bold else EN) if latin else (BOLD if bold else FONT)), size)

@lru_cache(maxsize=600)
def text_img(text, size, color, bold=False, latin=False):
    f = font(size, bold, latin)
    box = f.getbbox(text)
    im = Image.new('RGBA', (max(1, box[2]-box[0]+4), max(1,box[3]-box[1]+4)))
    ImageDraw.Draw(im).text((2-box[0],2-box[1]),text,font=f,fill=color)
    return im

def txt(im, text, xy, size=28, color=INK, bold=False, latin=False, anchor='left', alpha=1):
    layer = text_img(text,size,tuple(color),bold,latin)
    x,y=xy
    if anchor=='center': x-=layer.width/2
    if anchor=='right': x-=layer.width
    if alpha < 1:
        layer=layer.copy(); layer.putalpha(layer.getchannel('A').point(lambda a:int(a*max(0,alpha))))
    im.paste(layer,(round(x),round(y)),layer)

def rr(im,box,r=20,fill=WHITE,outline=None,width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(round(v) for v in box),r,fill,outline,width)

def ease(x):
    x=max(0,min(1,x)); return 1-(1-x)**3

def multiline(im, text, x, y, size=44, color=INK, bold=True, gap=17):
    for i,line in enumerate(text.split('\n')): txt(im,line,(x,y+i*(size+gap)),size,color,bold)

def pill(im, label, x, y, fill=SAGE, color=INK, size=16):
    tw=text_img(label,size,color).width
    rr(im,(x,y,x+tw+28,y+36),18,fill)
    txt(im,label,(x+14,y+8),size,color)
    return tw+28

def logo(im,x,y,size=60,color=INK):
    d=ImageDraw.Draw(im); s=size/60
    bx=x; by=y-4
    for j,h in enumerate([22,38,52,31]):
        xx=bx+j*12*s
        d.rounded_rectangle((xx,by+(52-h)*s/2,xx+6*s,by+(52+h)*s/2),3*s,fill=color)
    d.polygon([(bx+49*s,by),(bx+68*s,by),(bx+68*s,by+55*s),(bx+58*s,by+46*s),(bx+49*s,by+55*s)],fill=color)
    txt(im,'Voicemark',(x+85*s,y),size,color,True,True)

@lru_cache(maxsize=10)
def photo(name):
    p=cv2.imread(str(ROOT/'assets'/name))
    if p is None: raise FileNotFoundError(name)
    return cv2.cvtColor(p,cv2.COLOR_BGR2RGB)

def shot(name,zoom=1,center=(.5,.48),dim=0):
    src=photo(name); sh,sw=src.shape[:2]
    ch=min(sh,sw*H/W)/zoom; cw=ch*W/H
    x=max(0,min(sw-cw,center[0]*sw-cw/2)); y=max(0,min(sh-ch,center[1]*sh-ch/2))
    mat=np.array([[cw/W,0,x],[0,ch/H,y]],np.float32)
    arr=cv2.warpAffine(src,mat,(W,H),flags=cv2.INTER_LINEAR|cv2.WARP_INVERSE_MAP)
    if dim: arr=(arr.astype(np.float32)*(1-dim)).astype(np.uint8)
    return Image.fromarray(arr)

def shade(im,top=False):
    a=np.zeros((H,W,4),np.uint8)
    for y in range(H):
        v=max(0,(y-440)/280)*210
        if top: v=max(v,max(0,(200-y)/200)*90)
        a[y,:,3]=int(v)
    return Image.alpha_composite(im.convert('RGBA'),Image.fromarray(a)).convert('RGB')

def bg(t,dark=False):
    im=Image.new('RGB',(W,H),INK if dark else CREAM)
    d=ImageDraw.Draw(im)
    col=(34,60,51) if dark else (231,236,222)
    off=20*math.sin(t/6)
    d.ellipse((790+off,-250,1510+off,490),fill=col)
    d.ellipse((-260,480+off,250,1000+off),fill=col)
    return im

def brand_header(im,dark=False):
    c=CREAM if dark else INK
    logo(im,54,40,25,c)
    txt(im,'CONCEPT FILM',(1220,44),13,c,False,True,'right')

def steps(im,active):
    names=['記録','統合','整理','質問','出典']
    for i,name in enumerate(names):
        x=64+i*116
        rr(im,(x,570,x+96,606),18,SAGE if i==active else (228,233,219))
        txt(im,name,(x+48,579),17,INK,i==active,anchor='center')

def waveform(im,box,t,color=INK,bars=25,quiet=False):
    x,y,w,h=box; d=ImageDraw.Draw(im)
    for i in range(bars):
        level=.15 if quiet else .2+.65*abs(math.sin(i*1.93+t*3.1))*abs(math.cos(i*.43-t*1.4))
        bh=max(4,h*level); bw=w/bars*.45; px=x+i*w/bars
        d.rounded_rectangle((px,y+(h-bh)/2,px+bw,y+(h+bh)/2),bw/2,fill=color)

def phone(im,t,title='録音',x=842,y=73,w=304,h=553):
    rr(im,(x+10,y+15,x+w+10,y+h+15),43,(218,224,206))
    rr(im,(x,y,x+w,y+h),40,(28,42,36))
    rr(im,(x+7,y+7,x+w-7,y+h-7),34,WHITE)
    txt(im,'9:41',(x+26,y+22),13,INK,True,True)
    rr(im,(x+w/2-38,y+15,x+w/2+38,y+32),10,(25,35,29))
    for i in range(3): rr(im,(x+w-53+i*6,y+26-i*3,x+w-50+i*6,y+32),1,INK)
    txt(im,title,(x+25,y+65),26,INK,True)
    rr(im,(x+w/2-45,y+h-19,x+w/2+45,y+h-15),2,INK)
    return x,y,w,h

def cassette(im,x,y,t,active=True):
    rr(im,(x,y,x+234,y+154),22,(207,228,177),INK,2)
    rr(im,(x+13,y+15,x+221,y+135),12,(228,236,214),INK)
    txt(im,'VOICE / 01',(x+30,y+25),12,INK,True,True)
    rr(im,(x+30,y+62,x+204,y+104),21,(101,127,84))
    d=ImageDraw.Draw(im)
    for cx in (x+62,x+172):
        d.ellipse((cx-25,y+58,cx+25,y+108),fill=CREAM,outline=INK,width=2)
        for a in range(6):
            angle=a*math.pi/3+(t*1.6 if active else 0)
            d.line((cx+10*math.cos(angle),y+83+10*math.sin(angle),cx+20*math.cos(angle),y+83+20*math.sin(angle)),fill=INK,width=3)
        d.ellipse((cx-5,y+78,cx+5,y+88),fill=INK)
    d.polygon([(x+74,y+123),(x+161,y+123),(x+173,y+145),(x+61,y+145)],fill=(180,204,151),outline=INK)

def caption(im,t):
    cue=next((c for c in STORY['cues'] if c['start']<=t<c['end']),None)
    if cue is None:return
    text=cue['text']; size=29
    while text_img(text,size,WHITE).width>1150:size-=1
    tw=text_img(text,size,WHITE).width
    layer=Image.new('RGBA',(W,H))
    d=ImageDraw.Draw(layer); d.rounded_rectangle(((W-tw)/2-24,642,(W+tw)/2+24,698),16,fill=(15,27,22,225))
    im.paste(layer,(0,0),layer)
    txt(im,text,(W/2,655),size,WHITE,False,anchor='center')

def record(im,q):
    x,y,w,h=phone(im,q)
    txt(im,'残したい会話を、ここから。',(x+25,y+112),16,MUTED)
    active=q>=2
    cassette(im,x+35,y+163,q,active)
    if active:
        pill(im,'記録中',x+116,y+335,(251,226,214),(160,59,42),14)
        txt(im,'00:'+str(min(5,max(0,int(q)-2))).zfill(2),(x+w/2,y+383),31,INK,True,True,'center')
        waveform(im,(x+70,y+422,165,37),q,bars=19)
    else:txt(im,'準備できました',(x+w/2,y+365),18,MUTED,anchor='center')
    rr(im,(x+39,y+472,x+w-39,y+518),23,INK)
    txt(im,'停止して保存' if active else '記録を始める',(x+w/2,y+486),16,WHITE,True,anchor='center')
    if 1<q<2.4:
        r=10+28*ease((q-1)/1.4); ImageDraw.Draw(im).ellipse((x+w/2-r,y+494-r,x+w/2+r,y+494+r),outline=ORANGE,width=3)

def merge(im,q):
    # Two independent inputs from the SAME scene; no accuracy claim.
    for i,who in enumerate(['ミオの記録','レンの記録']):
        x=752+i*239; y=173+10*math.sin(q+i)
        rr(im,(x,y,x+207,y+238),23,WHITE,(213,222,205),2)
        txt(im,who,(x+22,y+24),20,INK,True)
        txt(im,'同じ会話',(x+22,y+63),16,MUTED)
        waveform(im,(x+22,y+98,168,58),q+i,bars=16)
        pill(im,'共有範囲を確認済み',x+11,y+187,SAGE,INK,13)
    if q>3:
        d=ImageDraw.Draw(im); e=ease((q-3)/1.2)
        for x in [855,1094]:d.line((x,420,x,420+40*e,970,470),fill=MUTED,width=2)
    if q>4:
        rr(im,(820,468,1127,553),18,INK)
        txt(im,'鎌倉の旅行相談',(974,487),23,WHITE,True,anchor='center')
        txt(im,'許可した範囲を、ひとつに',(974,522),15,SAGE,anchor='center')

def summary(im,q):
    x,y,w,h=phone(im,q,'旅行の相談')
    pill(im,'共有された記録',x+25,y+111,SAGE,INK,13)
    cards=[('決まったこと','土曜 10:00 / 駅前に集合',SAGE),('次にすること','アオイ：ランチのお店を探す',(238,226,192)),('まだ決めていないこと','海のあと、どのカフェに行く？',(227,233,226))]
    for i,(label,detail,col) in enumerate(cards):
        p=ease((q-i*.8)/.8); yy=y+175+i*104+(1-p)*25
        if p>0:
            rr(im,(x+18,yy,x+w-18,yy+89),14,col)
            txt(im,label,(x+31,yy+15),17,INK,True)
            txt(im,detail,(x+31,yy+48),13,INK)
    txt(im,'元の発言を見る  →',(x+30,y+511),16,INK,True)

def ask(im,q):
    x,y,w,h=phone(im,q,'旅行の相談 / AI')
    pill(im,'自分だけのAI会話',x+24,y+109,SAGE,INK,13)
    rr(im,(x+20,y+158,x+w-20,y+212),12,(236,240,230))
    txt(im,'参照中  1件：鎌倉の旅行相談',(x+31,y+177),13,INK)
    if q>1:
        rr(im,(x+74,y+239,x+w-19,y+289),15,INK)
        text='集合は何時？'; n=min(len(text),int((q-1)*7))
        txt(im,text[:n],(x+92,y+253),19,WHITE,True)
    if q>3:
        rr(im,(x+19,y+315,x+w-19,y+457),16,(234,240,225))
        if q<4: txt(im,'会話を確認しています…',(x+35,y+343),15,MUTED)
        else:
            txt(im,'土曜の10時です。',(x+35,y+338),22,INK,True)
            txt(im,'集合場所は駅前です。',(x+35,y+379),16,INK)
            rr(im,(x+34,y+415,x+w-34,y+444),8,WHITE)
            txt(im,'出典  00:18 レンの発言  →',(x+45,y+423),12,INK,True)
    txt(im,'記録をもとに、質問する',(x+w/2,y+494),14,MUTED,anchor='center')

def source(im,q):
    x,y,w,h=phone(im,q,'元の発言')
    txt(im,'鎌倉の旅行相談',(x+24,y+111),17,MUTED)
    txt(im,'00:18  レン',(x+24,y+175),18,INK,True)
    rr(im,(x+18,y+213,x+w-18,y+331),17,SAGE)
    txt(im,'「じゃあ、10時に',(x+34,y+237),22,INK,True)
    txt(im,'駅前で！」',(x+34,y+277),22,INK,True)
    waveform(im,(x+30,y+365,248,65),q,INK,27)
    rr(im,(x+30,y+451,x+w-30,y+457),3,(218,227,209))
    rr(im,(x+30,y+451,x+30+242*min(1,q/8),y+457),3,INK)
    txt(im,'原音の該当箇所へ',(x+w/2,y+481),17,INK,True,anchor='center')

def make_frame(t,subtitles=True):
    s=next(s for s in STORY['scenes'] if s['start']<=t<s['end']); typ=s['type']; q=t-s['start']; dur=s['end']-s['start']
    if typ in ['cafe','question','freeze','meta','resolution']:
        if typ=='cafe':
            if q<5: z=1.01+q*.006; c=(.5,.49)
            elif q<10:z=1.24+(q-5)*.008;c=(.35,.43)
            elif q<15:z=1.25+(q-10)*.008;c=(.52,.42)
            elif q<20:z=1.25+(q-15)*.008;c=(.71,.44)
            else:z=1.03+(q-20)*.01;c=(.5,.48)
        elif typ=='question':z=1.02+q*.015;c=(.53,.44)
        elif typ=='freeze':z=1.11;c=(.53,.44)
        elif typ=='meta':z=1.0+q*.006;c=(.49,.45)
        else:z=1.03+q*.007;c=(.5,.45)
        im=shade(shot(s['asset'],z,c,dim=.2 if typ=='freeze' else 0),True)
        txt(im,'Voicemark',(54,41),27,WHITE,True,True)
        txt(im,'CONCEPT FILM',(1220,44),13,WHITE,False,True,'right')
        if typ=='cafe' and q<4.8:
            pill(im,'ある日の午後 / 友達3人',54,96,CREAM,INK,16)
            multiline(im,'週末の、\nいつもの会話。',54,448,47,WHITE)
        if typ=='freeze':
            rr(im,(526,218,566,340),8,SAGE);rr(im,(593,218,633,340),8,SAGE)
            txt(im,'ちょっと、ストップ。',(640,407),49,WHITE,True,anchor='center')
            txt(im,'PAUSED  /  00:30',(640,482),17,SAGE,False,True,'center')
        if typ=='meta':
            rr(im,(800,166,1220,491),26,INK)
            pill(im,'突然ですが。',825,189,SAGE,INK,16)
            multiline(im,'その約束、\n覚えてる？',827,267,44,CREAM)
            txt(im,'会話は進む。記憶は、薄れる。',(827,427),19,SAGE)
        if typ=='question' and q>1:pill(im,'集合  9:00？  10:00？',54,106,CREAM,INK,21)
        if typ=='resolution':
            if q<2:pill(im,'会話を再開  ▶',54,102,SAGE,INK,18)
            if q>9:multiline(im,'じゃあ、\n話の続きを。',54,444,48,WHITE)
    elif typ in ['brand','end']:
        im=bg(t,True);brand_header(im,True)
        # A waveform gathers into the bookmark brand mark.
        waveform(im,(320,164,642,100),t,SAGE,47)
        logo(im,380,315,80,CREAM)
        txt(im,'話した時間に、しおりを。' if typ=='end' else '会話に、しおりを。',(640,453),37,SAGE,True,anchor='center')
        if typ=='end':
            txt(im,'記録する。まとめる。思い出す。',(640,536),22,CREAM,anchor='center')
            txt(im,'コンセプトPV / 画面・会話は演出です',(640,607),13,SAGE,anchor='center')
    else:
        im=bg(t);brand_header(im)
        kinds=['record','merge','summary','ask','source']; idx=kinds.index(typ)
        txt(im,str(idx+1).zfill(2),(64,135),24,MUTED,True,True)
        titles={'record':'話す前に、\nひと押し。','merge':'みんなの記録が、\nひとつの会話に。','summary':'決まったことが、\n見えてくる。','ask':'「あれ、何だっけ？」を\nそのまま聞く。','source':'答えの先に、\nあの発言。'}
        multiline(im,titles[typ],64,212,43 if typ=='ask' else 48)
        desc={'record':'残したい時間を、自分で記録。','merge':'同じ会話。共有を許可した範囲。','summary':'決定・次の行動・未決定を整理。','ask':'選んだ記録を、回答の材料に。','source':'元の文字と音声で、確かめる。'}
        txt(im,desc[typ],(64,391),24,MUTED)
        steps(im,idx)
        {'record':record,'merge':merge,'summary':summary,'ask':ask,'source':source}[typ](im,q)
        txt(im,'画面はコンセプトです',(1220,619),12,MUTED,anchor='right')
    if subtitles:caption(im,t)
    # Dissolve to/from black only at the ends; chapter cuts remain crisp.
    fade=min(1,t/.6,(DURATION-t)/.8)
    if fade<1:im=Image.blend(Image.new('RGB',(W,H),INK),im,max(0,fade))
    return im

def read_audio(path,rate):
    proc=subprocess.run([FFMPEG,'-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(rate),'pipe:1'],capture_output=True,check=True)
    return np.frombuffer(proc.stdout,dtype=np.float32).copy()

def make_audio():
    rate=44100; n=rate*DURATION; out=np.zeros((n,2),dtype=np.float32)
    def add(sig,start,amp=1,pan=0):
        a=int(start*rate); b=min(n,a+len(sig)); sig=sig[:b-a]*amp
        if b<=a:return
        out[a:b,0]+=sig*math.sqrt((1-pan)/2);out[a:b,1]+=sig*math.sqrt((1+pan)/2)
    def note(freq,dur=.7):
        t=np.arange(int(dur*rate),dtype=np.float32)/rate
        env=(1-np.exp(-t*55))*np.exp(-t*3.4)*np.clip((dur-t)/.08,0,1)
        return env*(np.sin(2*np.pi*freq*t)+.22*np.sin(2*np.pi*freq*2*t)+.06*np.sin(2*np.pi*freq*3*t))
    rng=np.random.default_rng(7102); beat=60/88
    chords=[[48,55,59,64],[45,52,55,59],[41,48,52,57],[43,50,55,59]]
    for k,start in enumerate(np.arange(0,DURATION,beat)):
        if 29.9<start<33:continue
        chord=chords[(k//8)%4]
        for off in [0,.5]:
            midi=chord[(k+int(off*2))%4]+12
            add(note(440*2**((midi-69)/12),1.15),start+off*beat,.034,(-.25 if k%2 else .25))
        if k%2==0:
            freq=440*2**((chord[0]-69)/12)
            add(note(freq,.6),start,.046,0)
        tickt=np.arange(int(.045*rate))/rate
        noise=rng.normal(0,1,len(tickt)).astype(np.float32)*np.exp(-tickt*90)
        add(noise,start+beat*.5,.006,.4)
    # Film-stop sweep and two soft UI confirmation tones.
    tt=np.arange(int(.4*rate))/rate
    add(np.sin(2*np.pi*(690*tt-720*tt**2))*np.exp(-tt*8),30,.12,0)
    for st in [47,60.5,72,84,98]:
        add(note(880,.25),st,.07,-.1);add(note(1318,.35),st+.10,.05,.1)
    reports=[]
    for i,cue in enumerate(STORY['cues']):
        p=ROOT/'audio'/f'voice-{i:02d}.wav'
        if not p.exists():raise RuntimeError(f'Missing narration: {p.name}')
        sig=read_audio(p,rate)
        if len(sig)<rate*.15:raise RuntimeError(f'Empty narration: {p.name}')
        maxlen=cue['end']-cue['start']-.1
        original=len(sig)/rate
        if original>maxlen:
            speed=original/maxlen
            proc=subprocess.run([FFMPEG,'-v','error','-i',str(p),'-af',f'atempo={speed:.6f}','-f','f32le','-ac','1','-ar',str(rate),'pipe:1'],capture_output=True,check=True)
            sig=np.frombuffer(proc.stdout,dtype=np.float32).copy()
        peak=float(np.max(np.abs(sig)))
        if peak>0:sig*=.59/peak
        start=cue['start'];a=int(max(0,start-.15)*rate);b=min(n,int((start+len(sig)/rate+.2)*rate))
        out[a:b]*=.38
        add(sig,start,1,0)
        reports.append({'cue':i,'start':start,'original_seconds':round(original,3),'final_seconds':round(len(sig)/rate,3),'fits':len(sig)/rate<=cue['end']-start+.03})
    # Exact 120-second fade and safe, unclipped mix.
    env=np.ones(n,dtype=np.float32); fin=int(rate*.8);fout=int(rate*1.7)
    env[:fin]=np.linspace(0,1,fin);env[-fout:]=np.linspace(1,0,fout)
    out*=env[:,None]
    peak=float(np.max(np.abs(out)))
    if peak>.92:out*=.92/peak
    pcm=(out*32767).astype('<i2')
    with wave.open(str(ROOT/'audio'/'mix.wav'),'wb') as wav:
        wav.setnchannels(2);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes(pcm.tobytes())
    (ROOT/'checks'/'audio.json').write_text(json.dumps({'sample_rate':rate,'seconds':DURATION,'mix_peak':float(np.max(np.abs(out))),'cues':reports},ensure_ascii=False,indent=2),encoding='utf-8')

def preview():
    times=[2,7,12,17,25,30.7,36,42.5,49,63,74,85,94,101,109,116]
    sheet=Image.new('RGB',(1280,4*206),(229,233,223))
    for i,t in enumerate(times):
        im=make_frame(t);im.save(ROOT/'checks'/f'frame-{t:05.1f}.jpg',quality=91)
        small=im.resize((320,180),Image.Resampling.LANCZOS)
        sheet.paste(small,((i%4)*320,(i//4)*206))
        txt(sheet,f'{t:05.1f}s',((i%4)*320+9,(i//4)*206+184),16,INK,True,True)
    sheet.save(ROOT/'checks'/'contact-sheet.jpg',quality=93)
    print('Preview frames and contact sheet rendered.',flush=True)

def render():
    make_audio()
    dest=ROOT/'Voicemark-PV-2min.mp4'
    cmd=[FFMPEG,'-hide_banner','-loglevel','warning','-y','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(ROOT/'audio'/'mix.wav'),'-vf','scale=1920:1080:flags=lanczos','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',str(DURATION),'-movflags','+faststart','-metadata','title=Voicemark | 話した時間に、しおりを。','-metadata','comment=Concept PV; AI-generated stills, animated UI and synthetic narration.',str(dest)]
    with (ROOT/'checks'/'encode.log').open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
        try:
            for i in range(DURATION*FPS):
                proc.stdin.write(make_frame(i/FPS).tobytes())
                if i%(FPS*10)==0:print(f'Rendered {i/FPS:.0f} / {DURATION} seconds',flush=True)
        finally:proc.stdin.close()
        code=proc.wait()
    if code:raise RuntimeError(f'Encoder failed: {code}')
    print(f'Created {dest}',flush=True)

def check():
    p=ROOT/'Voicemark-PV-2min.mp4';cap=cv2.VideoCapture(str(p))
    report={'opened':cap.isOpened(),'width':cap.get(cv2.CAP_PROP_FRAME_WIDTH),'height':cap.get(cv2.CAP_PROP_FRAME_HEIGHT),'fps':cap.get(cv2.CAP_PROP_FPS),'frames':cap.get(cv2.CAP_PROP_FRAME_COUNT),'bytes':p.stat().st_size,'sample_frames':[]}
    report['seconds']=report['frames']/report['fps']
    for t in [0,5,24,30,31,35,44,47,63,73,85,94,100,110,119.8]:
        cap.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,frame=cap.read()
        report['sample_frames'].append({'time':t,'decoded':ok})
        if ok and t in [31,63,85,110]:cv2.imwrite(str(ROOT/'checks'/f'encoded-{t}.jpg'),frame)
    cap.release()
    proc=subprocess.run([FFMPEG,'-v','error','-i',str(p),'-f','null','-'],capture_output=True)
    report['decode_exit']=proc.returncode;report['decode_errors']=proc.stderr.decode(errors='replace')
    audio=json.loads((ROOT/'checks'/'audio.json').read_text(encoding='utf-8'))
    report['all_narration_fits']=all(c['fits'] for c in audio['cues'])
    (ROOT/'checks'/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    assert abs(report['seconds']-120)<.05 and report['width']==1920 and report['height']==1080
    assert report['decode_exit']==0 and all(x['decoded'] for x in report['sample_frames']) and report['all_narration_fits']
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');parser.add_argument('--render',action='store_true');parser.add_argument('--check',action='store_true');a=parser.parse_args()
    if a.preview:preview()
    if a.render:render()
    if a.check:check()
