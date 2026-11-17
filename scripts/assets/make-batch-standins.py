"""Batch-card stand-ins from the user-supplied images supplied on 2026-11-17.

Usage (repo root, needs only Pillow + numpy):
    python scripts/assets/make-batch-standins.py [--sheets DIR] [--only NAME]

Reads out/www.orbix.studio/images/<source>.png (never modified) and writes
public/new-design/<name>.webp: RGBA WebP, 700 px tall, 3 % transparent margin,
the same format and placement slot as the earlier stand-ins
(docs/design/swipe-cutouts.md).

Three sources arrive already matted (kimchi, sourdough, milk kefir): their alpha
is used as given and only trimmed and downscaled. The sauerkraut source is
opaque on a near-white studio ground, so it is keyed here with the same
shadow-insensitive rule make-cutouts.py uses: only the part of the colour
difference that is not a darker or lighter ground counts, so the soft grey
contact shadow leaves with the ground. Edge colours are decontaminated against
the white plate, which removes the light fringe that would show on a pastel card.

The output is lossy WebP with lossless alpha, downscaled in premultiplied space
so transparent pixels do not bleed.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "out" / "www.orbix.studio" / "images"
DST = ROOT / "public" / "new-design"

TARGET_HEIGHT = 700  # the height every batch stand-in is drawn at
FILLS = {
    "black": (0, 0, 0),
    "lime": (0xB6, 0xF0, 0x74),
    "lilac": (0xDA, 0xB8, 0xF1),
    "blue": (0xB6, 0xE1, 0xFA),
}

# t0/t1: soft-alpha ramp for the white-ground key (distance from the ground colour).
JOBS = {
    "kimchi": dict(source="kimchi-bowl", key="alpha"),
    "kraut": dict(source="sauerkraut-bowl", key="white", t0=0.02, t1=0.10),
    "sourdough": dict(source="sourdough-loaf", key="alpha"),
    "milk-kefir": dict(source="milk-kefir-bottle", key="alpha"),
}


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def key_white(img: Image.Image, t0: float, t1: float) -> Image.Image:
    """Key an opaque subject off a near-white studio ground."""
    rgb = img.convert("RGB")
    arr = np.asarray(rgb, dtype=np.float32) / 255
    ground = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    # Only the part of the difference not parallel to white (i.e. not just a
    # darker or lighter ground) counts, so the contact shadow is ground.
    k = arr.sum(-1, keepdims=True) / 3
    orth = arr - k * ground
    alpha = smoothstep(t0, t1, np.sqrt((orth * orth).sum(-1)))
    # Dark, unsaturated remainder near the bowl is the cast shadow, not the subject.
    hsv = np.asarray(rgb.convert("HSV"), dtype=np.float32)
    sat, val = hsv[..., 1] / 255, hsv[..., 2] / 255
    shadow = (1 - alpha) * (1 - np.clip((sat - 0.04) / 0.08, 0, 1)) * np.clip((0.98 - val) / 0.25, 0, 1)
    alpha = alpha * (1 - shadow)
    # Decontaminate: F = plate + (C - plate) / a, solved against the white plate.
    a3 = np.maximum(alpha, 0.05)[..., None]
    fg = np.clip(ground + (arr - ground) / a3, 0, 1)
    return Image.fromarray((np.dstack([fg, alpha]) * 255 + 0.5).astype(np.uint8), "RGBA")


def trim(rgba: Image.Image) -> Image.Image:
    """Trim to the subject plus a 3 % margin of the longer side."""
    alpha = np.asarray(rgba)[..., 3]
    ys, xs = np.nonzero(alpha > 0.02 * 255)
    h, w = alpha.shape
    margin = int(0.03 * max(h, w))
    return rgba.crop((max(0, xs.min() - margin), max(0, ys.min() - margin),
                      min(w, xs.max() + 1 + margin), min(h, ys.max() + 1 + margin)))


def downscale(rgba: Image.Image, height: int) -> Image.Image:
    """Downscale to the stand-in height in premultiplied space; never upscale."""
    if rgba.height <= height:
        return rgba
    arr = np.asarray(rgba, dtype=np.float32) / 255
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    width = round(rgba.width * height / rgba.height)
    chans = [Image.fromarray(pm[..., c], "F").resize((width, height), Image.LANCZOS) for c in range(4)]
    pm = np.clip(np.dstack([np.asarray(c) for c in chans]), 0, 1)
    a = pm[..., 3:4]
    rgb = np.where(a > 1e-4, pm[..., :3] / np.maximum(a, 1e-4), 0)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a]) * 255 + 0.5).astype(np.uint8), "RGBA")


def sheet(cut_img: Image.Image, title: str) -> Image.Image:
    tile = cut_img.copy()
    tile.thumbnail((190, 300))
    s = Image.new("RGB", (4 * 192, tile.height + 22), (255, 255, 255))
    d = ImageDraw.Draw(s)
    d.text((4, 4), title, fill=(0, 0, 0))
    for i, col in enumerate(FILLS.values()):
        bg = Image.new("RGBA", tile.size, col + (255,))
        bg.alpha_composite(tile)
        s.paste(bg.convert("RGB"), (i * 192 + 1, 20))
    return s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sheets", type=Path)
    ap.add_argument("--only")
    args = ap.parse_args()
    for name, job in JOBS.items():
        if args.only and name != args.only:
            continue
        img = Image.open(SRC / f"{job['source']}.png")
        keyed = key_white(img, job["t0"], job["t1"]) if job["key"] == "white" else img.convert("RGBA")
        out_img = downscale(trim(keyed), TARGET_HEIGHT)
        out = DST / f"{name}.webp"
        out_img.save(out, "WEBP", quality=86, method=6, alpha_quality=100)
        print(f"{out.relative_to(ROOT)} {out_img.width}x{out_img.height} {out.stat().st_size} bytes")
        if args.sheets:
            args.sheets.mkdir(parents=True, exist_ok=True)
            sheet(out_img, f"{name} ({job['source']})").save(args.sheets / f"{name}.png")


if __name__ == "__main__":
    main()
