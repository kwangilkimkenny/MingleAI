import numpy as np
from PIL import Image, ImageFilter
import sys, os

ASSET = "/Users/namuneulbo/Desktop/MingleAI/apps/mobile/assets/images"
PREV = "/private/tmp/claude-501/-Users-namuneulbo-Desktop-MingleAI/01a3fd0b-ff67-49a2-8533-921a31240386/scratchpad"
CREAM = (244, 241, 234)

def key_out(src, out_cutout, out_preview, low=35, high=110):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    # green excess over the stronger of red/blue = how "green-screen" a pixel is
    key = G - np.maximum(R, B)
    # alpha ramp: key>=high -> 0 (transparent), key<=low -> 255 (opaque), linear between
    alpha = np.clip((high - key) / float(high - low), 0.0, 1.0)
    alpha = (alpha * 255).astype(np.uint8)
    # despill: pull green channel down to max(R,B) where the pixel leans green,
    # killing the green fringe on hair/edges without dulling skin/gold/burgundy.
    spill = key > 0
    Gd = G.copy()
    Gd[spill] = np.minimum(G[spill], np.maximum(R, B)[spill])
    rgb = np.stack([R, Gd, B], axis=-1).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])
    cut = Image.fromarray(rgba, "RGBA")
    # gentle 1px alpha feather to soften the matte edge
    ach = cut.split()[3].filter(ImageFilter.GaussianBlur(0.6))
    cut.putalpha(ach)
    cut.save(out_cutout)
    # preview composited on cream so we can eyeball the matte
    bg = Image.new("RGBA", cut.size, CREAM + (255,))
    Image.alpha_composite(bg, cut).convert("RGB").save(out_preview, quality=90)
    # report residual-green stats on kept pixels
    kept = alpha > 200
    resid = int((key[kept] > 15).sum())
    print(f"{os.path.basename(src)}: opaque_px={int(kept.sum())} residual_green_px={resid}")

key_out(f"{ASSET}/renaissance-video-call-man.png",   f"{ASSET}/renaissance-man-cutout.png",   f"{PREV}/prev-man.jpg")
key_out(f"{ASSET}/renaissance-video-call-woman.png", f"{ASSET}/renaissance-woman-cutout.png", f"{PREV}/prev-woman.jpg")
print("done")
