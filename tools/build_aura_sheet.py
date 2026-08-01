"""sozai_0146_dragonball_aura の連番PNGを、Three.jsで使うスプライトシートにまとめる。

・全フレーム共通の外接矩形で切り抜き（余白を落とす）
・タイル状に並べて1枚のPNGにする
・色はゲーム側でキャラごとに付け直すので、ここでは元の色のまま入れる
"""
import os, glob, json, sys
from PIL import Image

BASE = r"C:\Users\wtats\Downloads\sozai_0146_dragonball_aura\sozai_0146_dragonball_aura"
OUT = sys.argv[1]

JOBS = [
    # (フォルダ, 出力名, タイル幅, 列数)
    ("sozai_aura",    "aura_sheet.png",    192, 8),
    ("sozai_thunder", "thunder_sheet.png", 144, 8),
]

meta = {}
for sub, outname, tile_w, cols in JOBS:
    files = sorted(
        f for f in glob.glob(os.path.join(BASE, sub, "*.png"))
        if not os.path.basename(f).startswith("._")
    )
    if not files:
        print("skip", sub); continue

    # 全フレームの外接矩形
    L = T = 10**9; R = B = -1
    for f in files:
        bb = Image.open(f).convert("RGBA").getbbox()
        if bb is None:
            continue
        L = min(L, bb[0]); T = min(T, bb[1]); R = max(R, bb[2]); B = max(B, bb[3])
    cw, ch = R - L, B - T
    tile_h = int(round(tile_w * ch / cw))

    n = len(files)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (tile_w * cols, tile_h * rows), (0, 0, 0, 0))

    for i, f in enumerate(files):
        im = Image.open(f).convert("RGBA").crop((L, T, R, B))
        im = im.resize((tile_w, tile_h), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * tile_w, (i // cols) * tile_h))

    path = os.path.join(OUT, outname)
    sheet.save(path, optimize=True)
    meta[outname] = dict(frames=n, cols=cols, rows=rows,
                         tile=[tile_w, tile_h], sheet=list(sheet.size),
                         sourceCrop=[L, T, R, B],
                         kb=round(os.path.getsize(path) / 1024))
    print(outname, meta[outname])

print(json.dumps(meta, indent=1))
