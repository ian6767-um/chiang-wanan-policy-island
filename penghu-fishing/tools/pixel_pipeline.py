#!/usr/bin/env python3
"""
美術資產流水線（設計文件階段 12）：把 AI 生成的高解析度圖片轉成符合美術聖經的像素圖。

步驟：
  1. 縮小：偵測（或手動指定）像素格大小，用 box 或 nearest 取樣縮到目標尺寸（不用 bilinear）
  2. 調色盤量化：對應到 palette/master.hex；預設不抖色，背景可以選 4x4 Bayer 抖色
  3. 清理：移除孤立的單一像素、alpha 二值化
  4. 角色和魚（sprite）加 sel-out 描邊：外輪廓用同色階最暗的顏色，不用純黑
  5. 輸出 PNG 到 assets/，旁邊寫一份 .json 紀錄來源與參數

用法：
  python3 tools/pixel_pipeline.py 輸入.png --size 128x64 --type sprite --out assets/fish/f01.png
  python3 tools/pixel_pipeline.py sky.png --size 800x360 --type background --dither --out assets/backgrounds/b3_golden.png
"""
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import load_palette, darkest_in_ramp  # noqa: E402

BAYER4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=np.float32)
TYPES = ("background", "sprite", "icon", "ui")


def detect_cell(img_rgb, max_cell=16):
    """偵測「像素格大小」：找出顏色變化位置的最大公因數式間距（AI 圖常常是放大過的假像素）"""
    a = np.asarray(img_rgb, dtype=np.int16)
    diff_x = np.any(np.abs(np.diff(a, axis=1)) > 24, axis=(0, 2))
    diff_y = np.any(np.abs(np.diff(a, axis=0)) > 24, axis=(1, 2))
    best, best_score = 1, 0.0
    for c in range(2, max_cell + 1):
        idx_x = np.nonzero(diff_x)[0] + 1
        idx_y = np.nonzero(diff_y)[0] + 1
        if len(idx_x) == 0 or len(idx_y) == 0:
            break
        score = (np.mean(idx_x % c == 0) + np.mean(idx_y % c == 0)) / 2
        if score > 0.85 and score >= best_score:
            best, best_score = c, score
    return best


def downscale(img, size, cell, method):
    w, h = size
    if cell and cell > 1:
        # 先依像素格縮小，再調整到目標尺寸
        img = img.resize((max(1, img.width // cell), max(1, img.height // cell)), Image.NEAREST)
    resample = Image.BOX if method == "box" else Image.NEAREST
    if img.size != (w, h):
        img = img.resize((w, h), resample)
    return img


def quantize(rgb, palette, dither=False):
    """每個像素對應到調色盤最接近的顏色（加權 RGB 距離）；dither=True 時用 4x4 Bayer"""
    pal = np.array(palette, dtype=np.float32)
    px = rgb.astype(np.float32)
    h, w, _ = px.shape
    if dither:
        # 在兩個最近的顏色之間依 Bayer 門檻選擇
        flat = px.reshape(-1, 3)
        d = weighted_dist(flat, pal)
        order = np.argsort(d, axis=1)[:, :2]
        d1 = np.take_along_axis(d, order[:, :1], axis=1)[:, 0]
        d2 = np.take_along_axis(d, order[:, 1:2], axis=1)[:, 0]
        t = d1 / np.maximum(d1 + d2, 1e-6)  # 0：完全是第一色；0.5：一半一半
        th = (np.tile(BAYER4, (h // 4 + 1, w // 4 + 1))[:h, :w].reshape(-1) + 0.5) / 16
        pick = np.where(t > th * 0.5, order[:, 1], order[:, 0])
        return pal[pick].reshape(h, w, 3).astype(np.uint8)
    d = weighted_dist(px.reshape(-1, 3), pal)
    return pal[np.argmin(d, axis=1)].reshape(h, w, 3).astype(np.uint8)


def weighted_dist(a, pal):
    # 「紅均值」加權距離，比單純 RGB 歐氏距離更接近人眼
    rmean = (a[:, None, 0] + pal[None, :, 0]) / 2
    dr = a[:, None, 0] - pal[None, :, 0]
    dg = a[:, None, 1] - pal[None, :, 1]
    db = a[:, None, 2] - pal[None, :, 2]
    return (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db


def binarize_alpha(alpha, threshold=128):
    return np.where(alpha >= threshold, 255, 0).astype(np.uint8)


def remove_orphans(rgb, alpha):
    """移除孤立的單一像素：周圍 8 格都和它不同色 → 換成周圍最常見的顏色"""
    h, w, _ = rgb.shape
    out = rgb.copy()
    key = (rgb[:, :, 0].astype(np.int32) << 16) | (rgb[:, :, 1].astype(np.int32) << 8) | rgb[:, :, 2]
    count = 0
    for y in range(h):
        for x in range(w):
            if alpha[y, x] == 0:
                continue
            neigh = []
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < h and 0 <= xx < w and alpha[yy, xx]:
                        neigh.append(key[yy, xx])
            if len(neigh) == 8 and all(n != key[y, x] for n in neigh):
                vals, cnt = np.unique(neigh, return_counts=True)
                k = int(vals[np.argmax(cnt)])
                out[y, x] = ((k >> 16) & 255, (k >> 8) & 255, k & 255)
                count += 1
    return out, count


def sel_out(rgb, alpha):
    """sel-out 描邊：外輪廓像素換成同色階最暗的顏色（不用純黑）；受光的左上側保留原色"""
    h, w, _ = rgb.shape
    out = rgb.copy()
    n = 0
    for y in range(h):
        for x in range(w):
            if not alpha[y, x]:
                continue
            def a(yy, xx):
                return 0 <= yy < h and 0 <= xx < w and alpha[yy, xx]
            right, bottom = not a(y, x + 1), not a(y + 1, x)
            top, left = not a(y - 1, x), not a(y, x - 1)
            if not (right or bottom or top or left):
                continue
            if (top or left) and not (right or bottom):
                continue  # 受光側
            dark = darkest_in_ramp(tuple(int(v) for v in rgb[y, x]))
            if dark:
                out[y, x] = dark
                n += 1
    return out, n


def process(args):
    src = Path(args.input)
    img = Image.open(src).convert("RGBA")
    cell = args.cell if args.cell != "auto" else detect_cell(img.convert("RGB"))
    cell = int(cell)
    method = args.method or ("box" if args.type == "background" else "nearest")
    if args.trim:
        # 依像素格縮回原生解析度（取每格中心點），裁到不透明範圍，再補成偶數寬高
        a = np.asarray(img)[cell // 2::cell, cell // 2::cell]
        ys, xs = np.nonzero(a[:, :, 3] >= 128)
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        hh, ww = a.shape[:2]
        pad = np.zeros((hh + hh % 2, ww + ww % 2, 4), np.uint8)
        pad[:hh, :ww] = a
        small = Image.fromarray(pad, "RGBA")
        w, h = small.size
    else:
        if not args.size:
            raise SystemExit("需要 --size 或 --trim")
        w, h = (int(v) for v in args.size.lower().split("x"))
        if w % 2 or h % 2:
            raise SystemExit(f"目標尺寸必須是偶數：{w}x{h}")
        small = downscale(img, (w, h), cell, method)
    arr = np.asarray(small)
    rgb, alpha = arr[:, :, :3], arr[:, :, 3]
    alpha = binarize_alpha(alpha) if args.type != "background" else np.full_like(alpha, 255)
    palette = load_palette(args.palette)
    rgb = quantize(rgb, palette, dither=args.dither and args.type == "background")
    orphans = 0
    if not args.keep_orphans:
        rgb, orphans = remove_orphans(rgb, alpha)
    outlined = 0
    if args.type == "sprite" and not args.no_outline:
        rgb, outlined = sel_out(rgb, alpha)
    rgb[alpha == 0] = 0
    out = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")
    dest = Path(args.out)
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest)
    meta = {
        "source": str(src), "source_sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
        "size": [w, h], "type": args.type, "cell": cell, "method": method, "dither": bool(args.dither and args.type == "background"),
        "orphans_removed": orphans, "outline_pixels": outlined, "palette": str(args.palette),
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    dest.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    print(f"{dest}  {w}x{h}  格={cell}  {method}  孤立像素 {orphans}  描邊 {outlined}")


def main(argv=None):
    p = argparse.ArgumentParser(description="把 AI 生成圖轉成符合美術聖經的像素圖")
    p.add_argument("input")
    p.add_argument("--size", help="目標尺寸，例如 128x64")
    p.add_argument("--trim", action="store_true", help="輸入已經是放大的像素圖：縮回原生解析度並裁掉透明邊")
    p.add_argument("--type", choices=TYPES, required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--cell", default="auto", help="像素格大小（auto 自動偵測）")
    p.add_argument("--method", choices=("box", "nearest"), help="縮小取樣方式（預設：背景 box，其他 nearest）")
    p.add_argument("--dither", action="store_true", help="背景的天空、水深漸層使用 4x4 Bayer 抖色")
    p.add_argument("--no-outline", action="store_true")
    p.add_argument("--keep-orphans", action="store_true")
    p.add_argument("--palette", default=str(Path(__file__).resolve().parent.parent / "palette" / "master.hex"))
    process(p.parse_args(argv))


if __name__ == "__main__":
    main()
