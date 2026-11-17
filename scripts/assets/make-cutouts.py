"""Background-removed cutouts from the user-supplied pastel-ground images.

Usage (repo root, needs only Pillow + numpy):
    python scripts/assets/make-cutouts.py [--sheets DIR]

Reads out/www.orbix.studio/images/<source>.png (never modified) and writes
public/new-design/<name>.webp. With --sheets, also writes one contact sheet per
cutout composited on black, lime, lilac and blue for visual review.

Method: plain colour keying against a studio ground, no ML model.
1. Shadow-insensitive distance of every pixel to the ground colour: the part of
   the colour difference parallel to the ground (a darker or lighter ground,
   i.e. a cast shadow) is ignored; only the hue/chroma departure counts.
2. A hard mask from that distance is cleaned, reduced to the subject's
   connected component(s) (seed points) and hole-filled.
3. A per-row ground plate is interpolated from the pixels classified as ground,
   so gradients and shadows behind the subject are modelled locally.
4. Soft alpha = smoothstep of the distance to that plate; colours are
   decontaminated (C = a*F + (1-a)*plate solved for F) so no ground tint or
   halo remains. Clear glass keeps a minimum opacity with a neutral tint so it
   reads as glass rather than a hole. Per-job hue, zone and contact-shadow
   rules (see JOBS) remove coloured shadows the parallel rule misses.
5. Trim to the subject plus a small margin, downscale in premultiplied space
   to the stand-in height, save lossy WebP with lossless alpha.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "out" / "www.orbix.studio" / "images"
DST = ROOT / "public" / "new-design"

TARGET_HEIGHT = 700  # matches the existing stand-ins (kimchi/kombucha 700 px tall)
FILLS = {
    "black": (0, 0, 0),
    "lime": (0xB6, 0xF0, 0x74),
    "lilac": (0xDA, 0xB8, 0xF1),
    "blue": (0xB6, 0xE1, 0xFA),
}

# Job options (all coordinates are fractions of the source image):
#   roi          (x0, y0, x1, y1) crop processed; seeds: points on the subject.
#   hard         distance threshold of the hard subject mask; t0/t1: soft-alpha ramp.
#   solid_core   force alpha 1 inside the subject, core_px in from its edge.
#   floor        minimum alpha over the subject with a neutral tint (clear glass).
#   clip(fx, fy) -> bool  geometric limit; removes cast shadows whose hue
#                differs from the ground (the spritz's orange caustic shadow).
#   ground_hue   degrees within which a saturated pixel counts as ground at any
#                brightness (blue shadows on a blue ground). hue_in_mask: also
#                for the hard mask; hue_in_core: also inside the solid core.
#   hue_zone     ((x0, y0, x1, y1), degrees) wider ground-hue tolerance in a box,
#                with zone_floor as its minimum alpha (ground seen through a rim).
#   dark_shadow  dark, non-warm pixels near the edge count as ground (contact shadows).


def spritz_clip(fx: np.ndarray, fy: np.ndarray) -> np.ndarray:
    # glass outline below the lime wedge: straight walls, elliptical base
    walls = (fy < 0.70) | ((fx > 0.594) & (fx < 0.869))
    base = ((fx - 0.733) / 0.137) ** 2 + ((fy - 0.79) / 0.089) ** 2 <= 1
    return walls & ((fy < 0.79) | base)


JOBS = {
    "grapefruit-spritz": dict(
        source="hero", roi=(0.57, 0.0, 1.0, 1.0), seeds=[(0.75, 0.62)],
        hard=0.075, t0=0.03, t1=0.11, floor=0.18, solid_core=True, core_px=21,
        ground_hue=6, hue_in_mask=False, clip=spritz_clip,
        hue_zone=((0.0, 0.0, 0.78, 0.20), 14), zone_floor=0.38),
    "fruit-still-life": dict(
        source="fruit", roi=(0.0, 0.0, 1.0, 1.0),
        seeds=[(0.30, 0.20), (0.62, 0.40), (0.35, 0.68), (0.20, 0.47)],
        hard=0.09, t0=0.035, t1=0.12, floor=0.0, solid_core=True, ground_hue=28,
        hue_in_core=True, dark_shadow=True),
}


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def chroma_distance(img: np.ndarray, ground: np.ndarray) -> np.ndarray:
    """Distance of img to ground ignoring pure darkening/lightening of ground."""
    g2 = np.maximum((ground * ground).sum(-1, keepdims=True), 1e-6)
    k = (img * ground).sum(-1, keepdims=True) / g2
    orth = img - k * ground
    return np.sqrt((orth * orth).sum(-1))


def ground_hue_weight(img: np.ndarray, tol: float) -> np.ndarray:
    """1 where a pixel has the ground's hue (any brightness), else 0."""
    hsv = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).convert("HSV"), dtype=np.float32)
    hue, sat = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255
    ring = np.concatenate([hue[:8].ravel(), hue[-8:].ravel(), hue[:, :8].ravel(), hue[:, -8:].ravel()])
    g = np.median(ring)
    dh = np.abs((hue - g + 180) % 360 - 180)
    return (1 - smoothstep(tol, tol + 12, dh)) * smoothstep(0.02, 0.07, sat)


def dark_shadow_weight(img: np.ndarray) -> np.ndarray:
    """1 for dark, non-warm pixels (contact shadows), 0 for browns/reds/yellows."""
    hsv = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).convert("HSV"), dtype=np.float32)
    hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    warm = ((hue < 75) | (hue > 330)) & (sat > 0.15)
    return (1 - smoothstep(0.45, 0.62, val)) * ~warm


def row_plate(img: np.ndarray, is_ground: np.ndarray) -> np.ndarray:
    """Fill non-ground pixels by linear interpolation along each row."""
    h, w, _ = img.shape
    plate = img.copy()
    xs = np.arange(w)
    fallback = np.median(img[is_ground], axis=0)
    for y in range(h):
        g = is_ground[y]
        if g.all():
            continue
        if g.sum() < 2:
            plate[y] = fallback
            continue
        for c in range(3):
            plate[y, :, c] = np.interp(xs, xs[g], img[y, g, c])
    # smooth the plate vertically a little so per-row noise does not show
    p = Image.fromarray((plate * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))
    return np.asarray(p, dtype=np.float32) / 255


def select_subject(mask: np.ndarray, seeds, scale: int = 4) -> np.ndarray:
    """Keep the components under the seeds and fill their holes (downscaled)."""
    h, w = mask.shape
    small = Image.fromarray(mask.astype(np.uint8) * 255).resize(
        (w // scale, h // scale), Image.BILINEAR).point(lambda v: 255 if v > 96 else 0)
    keep = Image.new("L", small.size, 0)
    for sx, sy in seeds:
        work = small.copy()
        p = (int(sx * small.width), int(sy * small.height))
        if work.getpixel(p) == 255:
            ImageDraw.floodfill(work, p, 128)
            keep = Image.fromarray(np.maximum(np.asarray(keep),
                                              (np.asarray(work) == 128) * 255).astype(np.uint8))
    # hole fill: flood the outside from a padded border
    pad = Image.new("L", (keep.width + 2, keep.height + 2), 0)
    pad.paste(keep, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    filled = (np.asarray(pad)[1:-1, 1:-1] != 128).astype(np.uint8) * 255
    # upsample, then blur + re-threshold so the contour has no 4 px stair-steps
    big = (Image.fromarray(filled).resize((w, h), Image.BILINEAR)
           .filter(ImageFilter.GaussianBlur(scale)).point(lambda v: 255 if v > 127 else 0))
    return np.asarray(big, dtype=np.float32) / 255


def cut(job: dict) -> Image.Image:
    full = Image.open(SRC / f"{job['source']}.png").convert("RGB")
    W, H = full.size
    x0, y0, x1, y1 = job["roi"]
    box = (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))
    img = np.asarray(full.crop(box), dtype=np.float32) / 255
    h, w, _ = img.shape
    seeds = [((sx * W - box[0]) / w, (sy * H - box[1]) / h) for sx, sy in job["seeds"]]

    # pass 1: global ground from the image border
    border = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3),
                             img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
    ground = np.median(border, axis=0)
    d1 = chroma_distance(img, ground)
    gw = ground_hue_weight(img, job["ground_hue"]) if job.get("ground_hue") else 0.0
    if job.get("hue_in_mask", True):
        d1 = d1 * (1 - gw)
    hard = d1 > job["hard"]
    m = Image.fromarray(hard.astype(np.uint8) * 255)
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(3))
    region = select_subject(np.asarray(m) > 0, seeds)
    if job.get("clip"):
        fx = (np.arange(w)[None, :] + box[0]) / W
        fy = (np.arange(h)[:, None] + box[1]) / H
        region = region * job["clip"](fx, fy)

    # optional zone (source-fraction box) with a wider ground-hue tolerance,
    # applied to the solid core too: ground seen through the clear glass rim
    zone_gw = np.zeros((h, w), np.float32)
    floor = np.full((h, w), float(job["floor"]), np.float32)
    if job.get("hue_zone"):
        (zx0, zy0, zx1, zy1), ztol = job["hue_zone"]
        fx = (np.arange(w)[None, :] + box[0]) / W
        fy = (np.arange(h)[:, None] + box[1]) / H
        inside = (fx >= zx0) & (fx < zx1) & (fy >= zy0) & (fy < zy1)
        zone_gw = ground_hue_weight(img, ztol) * inside
        floor = np.where(inside, job.get("zone_floor", job["floor"]), floor).astype(np.float32)
        gw = np.maximum(gw, zone_gw)

    # pass 2: local ground plate from everything outside the (grown) subject
    grown = Image.fromarray((region * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15))
    is_ground = np.asarray(grown) < 8
    plate = row_plate(img, is_ground)
    d2 = chroma_distance(img, plate)
    # brighter-than-ground highlights (glass rims, ice) also count as subject
    lum = img.mean(-1)
    plum = plate.mean(-1)
    d2 = d2 + np.maximum(0, lum - plum) * 0.6
    d2 = d2 * (1 - gw)
    if job.get("dark_shadow"):
        edge = 1 - np.asarray(Image.fromarray((region * 255).astype(np.uint8))
                              .filter(ImageFilter.MinFilter(job.get("core_px", 9))), dtype=np.float32) / 255
        d2 = d2 * (1 - dark_shadow_weight(img) * edge)
    alpha = smoothstep(job["t0"], job["t1"], d2)

    # restrict to the subject region with a soft edge
    reg = Image.fromarray((region * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    reg = np.asarray(reg.filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32) / 255
    core = np.asarray(Image.fromarray((region * 255).astype(np.uint8))
                      .filter(ImageFilter.MinFilter(job.get("core_px", 9))), dtype=np.float32) / 255
    if job["solid_core"]:
        # enclosed ground pockets (shadows between fruit) stay transparent
        solid = core * (1 - gw) if job.get("hue_in_core", False) else core * (1 - zone_gw)
        alpha = np.maximum(alpha, solid)
    alpha = alpha * reg

    # decontaminate: F = plate + (C - plate) / a
    a3 = np.maximum(alpha, 0.05)[..., None]
    fg = np.clip(plate + (img - plate) / a3, 0, 1)

    if job["floor"] > 0:
        # clear glass: neutral tint at the observed brightness, minimum opacity
        rel = np.clip(lum / np.maximum(plum, 1e-3), 0, 1.2)[..., None]
        neutral = np.clip(np.array([0.93, 0.95, 0.97]) * rel, 0, 1)
        band = np.asarray(Image.fromarray((region * 255).astype(np.uint8))
                          .filter(ImageFilter.MinFilter(5)), dtype=np.float32) / 255
        need = np.clip((floor - alpha) / floor, 0, 1) * band
        fg = fg * (1 - need[..., None]) + neutral * need[..., None]
        alpha = np.maximum(alpha, floor * band)

    rgba = np.dstack([fg, alpha])
    # trim to subject + 3 % margin
    ys, xs = np.nonzero(alpha > 0.02)
    mx = int(0.03 * max(h, w))
    ty0, ty1 = max(0, ys.min() - mx), min(h, ys.max() + 1 + mx)
    tx0, tx1 = max(0, xs.min() - mx), min(w, xs.max() + 1 + mx)
    rgba = rgba[ty0:ty1, tx0:tx1]

    # downscale in premultiplied space so transparent pixels do not bleed
    pm = rgba.copy()
    pm[..., :3] *= pm[..., 3:4]
    hh, ww = pm.shape[:2]
    if hh > TARGET_HEIGHT:
        nw = round(ww * TARGET_HEIGHT / hh)
        chans = [Image.fromarray(pm[..., c].astype(np.float32), "F").resize((nw, TARGET_HEIGHT), Image.LANCZOS)
                 for c in range(4)]
        pm = np.dstack([np.asarray(c) for c in chans])
    pm = np.clip(pm, 0, 1)
    a = pm[..., 3:4]
    rgb = np.where(a > 1e-4, pm[..., :3] / np.maximum(a, 1e-4), 0)
    out = np.dstack([np.clip(rgb, 0, 1), a])
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")


def sheet(cut_img: Image.Image, title: str) -> Image.Image:
    tile = cut_img.copy()
    tile.thumbnail((190, 300))
    s = Image.new("RGB", (4 * 192, tile.height + 22), (255, 255, 255))
    d = ImageDraw.Draw(s)
    d.text((4, 4), title, fill=(0, 0, 0))
    for i, (name, col) in enumerate(FILLS.items()):
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
        img = cut(job)
        out = DST / f"{name}.webp"
        img.save(out, "WEBP", quality=86, method=6, alpha_quality=100)
        print(f"{out.relative_to(ROOT)} {img.width}x{img.height} {out.stat().st_size} bytes")
        if args.sheets:
            args.sheets.mkdir(parents=True, exist_ok=True)
            back = Image.open(out)
            sheet(back, f"{name} ({job['source']})").save(args.sheets / f"{name}.png")
            # edge close-up on black: centre-left strip at full output size
            crop = back.crop((0, back.height // 3, min(back.width, 380), back.height // 3 + 380))
            bg = Image.new("RGBA", crop.size, (0, 0, 0, 255))
            bg.alpha_composite(crop)
            bg.convert("RGB").save(args.sheets / f"{name}-edge-black.png")


if __name__ == "__main__":
    main()
