# SPDX-License-Identifier: GPL-3.0-only
# Optional editable source for the three new geometric textures. Requires Pillow.
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]/'public/descensus-2/img'
for name,size in [('two-by-four.png',(32,256)),('seesaw.png',(384,64)),('spinner.png',(384,384))]:
 im=Image.new('RGBA',size,(0,0,0,0));d=ImageDraw.Draw(im);w,h=size
 if name=='spinner.png':
  d.rectangle((0,160,383,223),fill='#a96d37',outline='#4e321f',width=6);d.rectangle((160,0,223,383),fill='#a96d37',outline='#4e321f',width=6);d.ellipse((158,158,226,226),fill='#d9b176',outline='#4e321f',width=5)
 else:
  d.rectangle((0,0,w-1,h-1),fill='#ae783f',outline='#50351f',width=3)
  for k in range(8,h-4,13):d.line((4,k,w-5,k+2),fill='#c79659',width=2)
  d.ellipse((w//2-4,h//2-4,w//2+4,h//2+4),fill='#5a3b27')
 im.save(root/name)
