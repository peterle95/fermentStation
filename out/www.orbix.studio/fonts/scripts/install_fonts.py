#!/usr/bin/env python3
"""Install original font data without modification. Requires: pip install fonttools."""
import argparse, os, re, shutil, sys, json, hashlib
from pathlib import Path
try:
 from fontTools.ttLib import TTFont
except ImportError:
 print('Install dependency: pip install fonttools',file=sys.stderr); raise SystemExit(1)
ROOT=Path(__file__).resolve().parents[1]
WEIGHTS={100:'thin',200:'extralight',300:'light',400:'regular',500:'medium',600:'semibold',700:'bold'}
FORMATS={'.otf':'opentype','.ttf':'truetype','.woff':'woff','.woff2':'woff2'}

def names(font):
 records=font['name'].names
 return ' '.join(sorted(set(x.toUnicode() for x in records if x.nameID in [1,2,4,6,16,17])))

def css_src(name, fmt, rangeval=None):
 return f"@font-face {{ font-family: 'Unique Display'; src: url('./{name}') format('{fmt}'); font-style: normal; font-weight: {rangeval}; font-display: swap; }}"

def main():
 a=argparse.ArgumentParser(); a.add_argument('source',type=Path,help='Directory of extracted ORIGINAL font package'); a.add_argument('--dry-run',action='store_true'); args=a.parse_args()
 paths=sorted(p for p in args.source.rglob('*') if p.is_file() and p.suffix.lower() in FORMATS)
 if not paths:raise SystemExit('No original .otf/.ttf/.woff/.woff2 files found.')
 selected={}; var=None
 for p in paths:
  try:
   f=TTFont(str(p),lazy=True); name=names(f)
   if 'unique' not in name.lower() and 'unique' not in p.name.lower():continue
   if 'fvar' in f:
    axes={x.axisTag:(x.minValue,x.maxValue) for x in f['fvar'].axes}
    if 'wght' in axes:var=(p,axes['wght']); continue
   w=int(f['OS/2'].usWeightClass)
   # Map to nearest conventional weight for static seven-face package
   if w in WEIGHTS and w not in selected:selected[w]=p
   else:print(f'UNMAPPED weight={w} name={name}: {p.name}')
  except Exception as e:print(f'Skipping unreadable font {p}: {e}',file=sys.stderr)
 if not selected and not var:raise SystemExit('Could not identify Unique font binaries.')
 plan=[]; out_css=[]
 if var:
  p,(vmin,vmax)=var; ext=p.suffix.lower(); dest='unique-variable'+ext
  plan.append((p,dest));out_css.append(css_src(dest,FORMATS[ext],f'{int(vmin)} {int(vmax)}'))
 else:
  for w,p in sorted(selected.items()):
   ext=p.suffix.lower(); dest=f'unique-{w}'+ext
   plan.append((p,dest));out_css.append(css_src(dest,FORMATS[ext],str(w)))
 if len(selected)<7 and not var:print(f'WARNING: Found {len(selected)} / 7 static weights. Missing: {sorted(set(WEIGHTS)-set(selected))}')
 if args.dry_run:
  for src,dest in plan:print(src,'->',dest)
  print('\n'.join(out_css));return
 for dirpath in [ROOT/'specimen/fonts',ROOT/'web/public/fonts']:
  dirpath.mkdir(exist_ok=True,parents=True)
  for existing in dirpath.glob('unique-*'):
   if existing.is_file() and existing.suffix.lower() in FORMATS:existing.unlink()
  for src,dest in plan:
   shutil.copyfile(src,dirpath/dest)
   if hashlib.sha256(src.read_bytes()).digest()!=hashlib.sha256((dirpath/dest).read_bytes()).digest():raise SystemExit('Byte mismatch during font installation!')
  (dirpath/'unique.css').write_text('/* Original Unique Typeface by Rajesh Rajput, font bytes unmodified. */\n'+'\n'.join(out_css)+'\n',encoding='utf-8')
 print('Installed',len(plan),'byte-identical original font file(s) into specimen/fonts and web/public/fonts.')
 print('Next: python scripts/audit_fonts.py',str(args.source),'--json charset/actual-font-coverage.json')
if __name__=='__main__':main()
