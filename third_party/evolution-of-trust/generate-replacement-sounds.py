# SPDX-License-Identifier: GPL-3.0-only
# Original synthetic interface cues for this adaptation. No source recordings.
from pathlib import Path
import math,random,struct,wave,json,hashlib
OUT=Path(__file__).resolve().parent/'authored'/'sounds'
OUT.mkdir(parents=True,exist_ok=True)
RATE=22050
manifest=[]
specs={'button1':(440,.12),'button2':(660,.12),'button3':(880,.12),'bonk':(145,.18),'machine_start':(260,.6),'scratch_in':(340,.3),'scratch_out':(220,.3)}
for name,(frequency,duration)in specs.items():
 rng=random.Random('playgarden-trust-audio-'+name)
 samples=[]
 for i in range(round(RATE*duration)):
  t=i/RATE;progress=t/duration;envelope=min(1,t/.012)*(1-progress)**2
  if name.startswith('scratch_'):
   signal=(rng.random()*2-1)*.35+math.sin(2*math.pi*frequency*t)*.1
  elif name=='machine_start':
   signal=math.sin(2*math.pi*(frequency*t+180*t*t))*.33
  else:signal=math.sin(2*math.pi*frequency*t)*.42
  samples.append(round(max(-1,min(1,signal*envelope))*32767))
 path=OUT/(name+'.wav')
 with wave.open(str(path),'wb')as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(struct.pack('<'+'h'*len(samples),*samples))
 data=path.read_bytes();manifest.append({'path':path.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'license':'GPL-3.0-only','origin':'Playgarden original mathematical synthesis; no third-party recordings','durationSeconds':duration})
(OUT.parent/'sound-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Created original replacement cues:',len(manifest))
