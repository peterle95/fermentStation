#!/usr/bin/env python3
"""Inspect ACTUAL cmap, weights, OpenType features of supplied original font files."""
import argparse, json, csv, sys, unicodedata
from pathlib import Path
try:from fontTools.ttLib import TTFont
except ImportError:raise SystemExit('Install dependency: pip install fonttools')
ROOT=Path(__file__).resolve().parents[1]
EXT={'.otf','.ttf','.woff','.woff2'}
def main():
 a=argparse.ArgumentParser();a.add_argument('source',type=Path);a.add_argument('--json',type=Path,default=ROOT/'charset/actual-font-coverage.json');args=a.parse_args()
 groups=json.loads((ROOT/'charset/groups.json').read_text(encoding='utf-8'))
 target=set(''.join(groups.values()))
 out=[]
 for p in sorted(args.source.rglob('*')):
  if not p.is_file() or p.suffix.lower() not in EXT:continue
  try:ft=TTFont(str(p),lazy=False)
  except Exception as e:print('Skipped',p,e,file=sys.stderr);continue
  names={i:sorted(set(x.toUnicode() for x in ft['name'].names if x.nameID==i)) for i in [1,2,4,6,16,17]}
  full=' '.join(z for a in names.values() for z in a)
  if 'unique' not in full.lower() and 'unique' not in p.name.lower():continue
  cps=set().union(*(set(t.cmap) for t in ft['cmap'].tables if t.isUnicode()))
  feats=sorted({r.FeatureTag for table in ('GSUB','GPOS') if table in ft for r in (ft[table].table.FeatureList.FeatureRecord if ft[table].table.FeatureList else [])})
  axes=[{'tag':x.axisTag,'min':x.minValue,'default':x.defaultValue,'max':x.maxValue} for x in ft['fvar'].axes] if 'fvar' in ft else []
  missing=sorted(target-cps)
  rec={'file':p.name,'font_names':names,'weight_class':int(ft['OS/2'].usWeightClass),'unicode_codepoints':len(cps),'total_glyphs':len(ft.getGlyphOrder()),'missing_target_count':len(missing), 'missing_target':[{'codepoint':f'U+{c:04X}','character':chr(c),'name':unicodedata.name(chr(c),'UNKNOWN')} for c in missing], 'codepoints':[f'U+{c:04X}' for c in sorted(cps)],'features':feats,'variable_axes':axes}
  out.append(rec)
  print(p.name, '| weight',rec['weight_class'],'| Unicode',len(cps),'| glyphs',rec['total_glyphs'],'| missing of target',len(missing),'| features',','.join(feats),'| axes',axes)
 if not out:raise SystemExit('No Unique fonts found. Download original fonts, then try again.')
 dest=args.json if args.json.is_absolute() else ROOT/args.json;dest.parent.mkdir(parents=True,exist_ok=True)
 dest.write_text(json.dumps({'source':'actual font binary inspection','files':out},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Wrote verified report:',dest)
if __name__=='__main__':main()
