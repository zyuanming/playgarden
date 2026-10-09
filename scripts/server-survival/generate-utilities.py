# SPDX-License-Identifier: GPL-3.0-only
# Project-authored, finite static CSS generator. Never evaluates downloaded JavaScript.
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[2]
colors_text=(ROOT/'vendor/tailwind-static/colors.js').read_text()
colors={'black':'#000000','white':'#ffffff','transparent':'transparent','current':'currentColor','inherit':'inherit'}
for name,body in re.findall(r'^  (\w+): \{(.*?)\n  \}',colors_text,re.S|re.M):
 for n,value in re.findall(r"(\d+): '(#[a-f0-9]+)'",body):colors[name+'-'+n]=value
sources='\n'.join(p.read_text() for p in (ROOT/'vendor/server-survival-full/upstream').rglob('*') if p.is_file())
# Covers static HTML and complete quoted class strings in the runtime. The generation
# report lists unrecognized tokens for review rather than silently inventing styles.
classes=set()
for m in re.finditer(r'(?:class|className)=["\']([^"\']+)',sources):
 for v in m.group(1).split():
  if not any(c in v for c in ['$', '{', '}', '\\','<','>']):classes.add(v)
for m in re.finditer(r'["\']([a-zA-Z][a-zA-Z0-9:\-\[\]#/.%]+)["\']',sources):
 v=m.group(1)
 if v.startswith(('text-','bg-','border','opacity-','hidden','flex','grid','w-','h-','rounded','pointer-','animate-','cursor-')):classes.add(v)
# Conditional ternary strings containing a slash can be missed by HTML extraction.
for v in re.findall(r'(?<![\w-])(?:hover:)?(?:bg|text|border)-(?:[a-z]+-\d+|black|white|transparent)(?:/\d+)?',sources):classes.add(v)
def space(v):
 if v.startswith('[') and v.endswith(']'):return v[1:-1].replace('_',' ')
 if v=='px':return '1px'
 if v=='full':return '100%'
 if v=='auto':return 'auto'
 if '/' in v:
  a,b=v.split('/');return str(float(a)/float(b)*100)+'%'
 try:return str(float(v)*.25)+'rem'
 except ValueError:return None
def color(v):
 a,slash,b=v.partition('/');base=colors.get(a)
 if not base:return None
 if slash and base.startswith('#'):
  if len(base)==4:base='#'+''.join(c*2 for c in base[1:])
  return f'rgba({int(base[1:3],16)},{int(base[3:5],16)},{int(base[5:7],16)},{float(b)/100})'
 return base
simple={
 'absolute':'position:absolute','fixed':'position:fixed','relative':'position:relative',
 'block':'display:block','inline-block':'display:inline-block','flex':'display:flex','grid':'display:grid','hidden':'display:none',
 'flex-col':'flex-direction:column','flex-wrap':'flex-wrap:wrap','flex-1':'flex:1 1 0%','flex-shrink-0':'flex-shrink:0',
 'items-center':'align-items:center','items-start':'align-items:flex-start','items-end':'align-items:flex-end','justify-center':'justify-content:center','justify-between':'justify-content:space-between',
 'pointer-events-none':'pointer-events:none','pointer-events-auto':'pointer-events:auto','cursor-pointer':'cursor:pointer','cursor-not-allowed':'cursor:not-allowed',
 'font-mono':'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace','font-normal':'font-weight:400','font-bold':'font-weight:700','font-black':'font-weight:900','italic':'font-style:italic','uppercase':'text-transform:uppercase',
 'text-left':'text-align:left','text-center':'text-align:center','text-right':'text-align:right','leading-relaxed':'line-height:1.625','tracking-tighter':'letter-spacing:-.05em','tracking-wider':'letter-spacing:.05em','tracking-widest':'letter-spacing:.1em',
 'list-disc':'list-style-type:disc','list-inside':'list-style-position:inside','truncate':'overflow:hidden;text-overflow:ellipsis;white-space:nowrap','outline-none':'outline:2px solid transparent;outline-offset:2px',
 'min-h-screen':'min-height:100vh','min-w-0':'min-width:0','max-w-full':'max-width:100%',
 'overflow-hidden':'overflow:hidden','overflow-y-auto':'overflow-y:auto','overflow-x-auto':'overflow-x:auto','overflow-y-hidden':'overflow-y:hidden',
 'bg-clip-text':'background-clip:text;-webkit-background-clip:text','bg-gradient-to-r':'background-image:linear-gradient(to right,var(--pg-from),var(--pg-to))',
 'border':'border-width:1px','border-2':'border-width:2px','border-b':'border-bottom-width:1px','border-b-2':'border-bottom-width:2px','border-t':'border-top-width:1px','border-l':'border-left-width:1px','border-r':'border-right-width:1px',
 'rounded': 'border-radius:.25rem','rounded-sm':'border-radius:.125rem','rounded-lg':'border-radius:.5rem','rounded-xl':'border-radius:.75rem','rounded-2xl':'border-radius:1rem','rounded-full':'border-radius:9999px','rounded-bl':'border-bottom-left-radius:.25rem',
 'shadow-lg':'box-shadow:0 10px 15px -3px #0000001a,0 4px 6px -4px #0000001a','shadow-2xl':'box-shadow:0 25px 50px -12px #00000040',
 'backdrop-blur-sm':'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)',
 'transition':'transition:color,background-color,border-color,opacity,box-shadow,transform;transition-duration:150ms','transition-all':'transition-property:all;transition-duration:150ms','transition-colors':'transition-property:color,background-color,border-color;transition-duration:150ms','transition-transform':'transition-property:transform;transition-duration:150ms',
 'transform':'transform:translate(var(--pg-x,0),var(--pg-y,0)) scale(var(--pg-scale,1))','filter':'filter:var(--pg-drop,none)',
 'animate-pulse':'animation:pg-pulse 2s cubic-bezier(.4,0,.6,1) infinite','animate-bounce':'animation:pg-bounce 1s infinite',
}
font={'xs':('.75rem','1rem'),'sm':('.875rem','1.25rem'),'base':('1rem','1.5rem'),'lg':('1.125rem','1.75rem'),'xl':('1.25rem','1.75rem'),'2xl':('1.5rem','2rem'),'3xl':('1.875rem','2.25rem'),'4xl':('2.25rem','2.5rem'),'5xl':('3rem','1'),'6xl':('3.75rem','1')}
maxw={'xs':'20rem','md':'28rem','xl':'36rem','2xl':'42rem','3xl':'48rem','4xl':'56rem'}
def declaration(c):
 if c in simple:return simple[c]
 for prefix,prop in [('bg-','background-color'),('text-','color'),('border-','border-color'),('accent-','accent-color'),('from-','--pg-from'),('to-','--pg-to')]:
  if c.startswith(prefix) and (v:=color(c[len(prefix):])):return f'{prop}:{v}'
 if c.startswith('text-'):
  v=c[5:]
  if v in font:a,b=font[v];return f'font-size:{a};line-height:{b}'
  if v.startswith('['):return f'font-size:{space(v)}'
 if c.startswith('max-w-') and c[6:] in maxw:return 'max-width:'+maxw[c[6:]]
 for prefix,props in [('p-',['padding']),('px-',['padding-left','padding-right']),('py-',['padding-top','padding-bottom']),('pt-',['padding-top']),('pb-',['padding-bottom']),('pl-',['padding-left']),('pr-',['padding-right']),('m-',['margin']),('mx-',['margin-left','margin-right']),('my-',['margin-top','margin-bottom']),('mt-',['margin-top']),('mb-',['margin-bottom']),('ml-',['margin-left']),('mr-',['margin-right']),('gap-',['gap']),('w-',['width']),('h-',['height']),('max-h-',['max-height']),('max-w-',['max-width']),('left-',['left']),('right-',['right']),('top-',['top']),('bottom-',['bottom']),('inset-',['inset'])]:
  if c.startswith(prefix) and (v:=space(c[len(prefix):])) is not None:return ';'.join(p+':'+v for p in props)
 if c.startswith('grid-cols-'):return 'grid-template-columns:repeat('+c[10:]+',minmax(0,1fr))'
 if c.startswith('opacity-'):return 'opacity:'+str(float(c[8:])/100)
 if c.startswith('duration-'):return 'transition-duration:'+c[9:]+'ms'
 if c.startswith('z-'):return 'z-index:'+c[2:].strip('[]')
 if c.startswith('scale-'):return '--pg-scale:'+str(float(c[6:])/100)+';transform:translate(var(--pg-x,0),var(--pg-y,0)) scale(var(--pg-scale))'
 if c.startswith('-translate-'):
  axis=c[11];v=space(c[13:]);return f'--pg-{axis}:-{v};transform:translate(var(--pg-x,0),var(--pg-y,0)) scale(var(--pg-scale,1))'
 for side in ['b','l','r']:
  if c.startswith('border-'+side+'-'):
   v=c[len('border-'+side+'-'):];property={'b':'bottom','l':'left','r':'right'}[side]
   if color(v):return f'border-{property}-color:{color(v)}'
   if v.startswith('['):return f'border-{property}-width:{space(v)}'
 if c.startswith('shadow-['):return 'box-shadow:'+c[8:-1].replace('_',' ')
 if c.startswith('drop-shadow-['):return '--pg-drop:drop-shadow('+c[13:-1].replace('_',' ')+');filter:var(--pg-drop)'
 return None
pre=(ROOT/'vendor/tailwind-static/preflight.css').read_text()
# Resolve documented theme fallbacks without evaluating a JS configuration.
pre=re.sub(r"theme\('borderColor.DEFAULT', currentColor\)",'#e5e7eb',pre)
pre=re.sub(r"theme\('fontFamily.sans', (.*?)\)",lambda m:m[1],pre)
pre=re.sub(r"theme\('fontFamily.mono', (.*?)\)",lambda m:m[1],pre)
pre=re.sub(r"theme\('fontFamily\.[^']+', normal\)",'normal',pre)
pre=pre.replace("theme('colors.gray.400', #9ca3af)",'#9ca3af')
assert 'theme(' not in pre
out=['/* Static utility subset generated by Playgarden. Tailwind preflight/palette: MIT, Tailwind Labs, Inc.; see LICENSE-tailwind.txt. */',pre,'@keyframes pg-pulse{50%{opacity:.5}}@keyframes pg-bounce{0%,100%{transform:translateY(-25%)}50%{transform:translateY(0)}}']
unknown=[]
for original in sorted(classes,key=lambda c:((':' in c),c=='hidden',c)):
 variants=original.split(':');base=variants.pop();selector='.'+re.sub(r'([^a-zA-Z0-9_-])',lambda m:'\\'+m[1],original)
 if base.startswith('space-y-'):
  v=space(base[8:]);decl='margin-top:'+v+';margin-bottom:0';selector+=' > :not([hidden]) ~ :not([hidden])'
 else:decl=declaration(base)
 if not decl:unknown.append(original);continue
 media=None
 for variant in variants:
  if variant=='hover':selector+=':hover'
  elif variant=='sm':media='640px'
  elif variant=='md':media='768px'
  else:unknown.append(original);decl=None
 if decl:
  css=selector+'{'+decl+'}'
  out.append('@media(min-width:'+media+'){'+css+'}' if media else css)
# Keep visibility stronger than later flex/grid declarations, matching utility layer intent.
out.append('.hidden{display:none!important}')
(ROOT/'public/server-survival-full/utilities.css').write_text('\n'.join(out)+'\n')
(ROOT/'docs/server-survival-css-report.json').write_text(json.dumps({'candidates':len(classes),'generated':len(classes)-len(unknown),'upstreamCustomClasses':unknown},indent=2)+'\n')
print(json.dumps({'candidates':len(classes),'generated':len(classes)-len(unknown),'unrecognized':unknown}))
