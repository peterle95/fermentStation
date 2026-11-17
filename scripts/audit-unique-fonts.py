"""Audit the shipped, unmodified Unique faces. Requires fonttools and brotli."""
import hashlib
import json
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
GROUPS = json.loads((ROOT / "docs/design/unique-charset.json").read_text(encoding="utf-8"))
report = []
for path in sorted((ROOT / "public/fonts/unique").glob("*.woff2")):
    with TTFont(path) as font:
        cmap = font.getBestCmap()
        features = sorted({record.FeatureTag for tag in ("GSUB", "GPOS") if tag in font
                           for record in font[tag].table.FeatureList.FeatureRecord})
        report.append({
            "file": path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "family": font["name"].getDebugName(1),
            "subfamily": font["name"].getDebugName(2),
            "weight": font["OS/2"].usWeightClass,
            "variable_axes": [{"tag": axis.axisTag, "min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
                              for axis in font["fvar"].axes] if "fvar" in font else [],
            "encoded_codepoints": len(cmap),
            "glyphs": len(font.getGlyphOrder()),
            "features": features,
            "groups": {name: {"tested": len(set(text)), "missing": [f"U+{ord(c):04X}" for c in sorted(set(text)) if ord(c) not in cmap]}
                       for name, text in GROUPS.items()},
            "codepoints": [f"U+{code:04X}" for code in sorted(cmap)],
        })
assert sorted(face["weight"] for face in report) == list(range(100, 701, 100))
output = ROOT / "docs/design/unique-font-audit.json"
output.write_text(json.dumps({"source": "fontTools inspection of original Web-TT WOFF2 bytes", "faces": report}, indent=2) + "\n", encoding="utf-8")
for face in report:
    missing = sum(len(group["missing"]) for group in face["groups"].values())
    print(f'{face["file"]}: weight {face["weight"]}, {face["encoded_codepoints"]} codepoints, {face["glyphs"]} glyphs, {missing} missing group entries')
