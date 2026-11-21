#!/usr/bin/env python3
"""
檢查 assets/ 裡的所有 PNG 是否符合美術聖經（設計文件階段 12）：
  - 所有顏色都在 palette/master.hex 裡
  - 沒有半透明像素（alpha 只能是 0 或 255）
  - 寬高都是偶數
  - 尺寸符合該資料夾的規格（見 SPECS）
有任何問題就列出來並以錯誤碼 1 結束。可以放進 CI 或 git pre-commit hook。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import load_palette, ROOT  # noqa: E402

# 資料夾 → 允許的尺寸（None 代表不限，但仍要是偶數）
SPECS = {
    "backgrounds": [(800, 360)],
    "underwater": [(800, 170)],
    "fish/codex": [(128, 64), (192, 80)],
    "portraits": [(180, 200)],
    "icons": None,
    "ui": None,
    "fish/swim": None,
    "fish/pack": None,
    "characters": None,
}


def spec_for(rel):
    parts = rel.parts
    for key in sorted(SPECS, key=len, reverse=True):
        kp = tuple(key.split("/"))
        if parts[: len(kp)] == kp:
            return key, SPECS[key]
    return None, None


def check_file(path, palette_set, assets_dir):
    problems = []
    img = Image.open(path)
    w, h = img.size
    if w % 2 or h % 2:
        problems.append(f"寬高不是偶數：{w}x{h}")
    rel = path.relative_to(assets_dir)
    key, sizes = spec_for(rel)
    if sizes and (w, h) not in sizes:
        problems.append(f"尺寸 {w}x{h} 不符合 {key} 的規格 {sizes}")
    rgba = np.asarray(img.convert("RGBA"))
    alpha = rgba[:, :, 3]
    semi = np.count_nonzero((alpha > 0) & (alpha < 255))
    if semi:
        problems.append(f"有 {semi} 個半透明像素")
    opaque = rgba[alpha > 0][:, :3]
    if len(opaque):
        keys = np.unique((opaque[:, 0].astype(np.int32) << 16) | (opaque[:, 1].astype(np.int32) << 8) | opaque[:, 2])
        bad = [k for k in keys.tolist() if k not in palette_set]
        if bad:
            sample = ", ".join("#%06x" % k for k in bad[:6])
            problems.append(f"有 {len(bad)} 種顏色不在調色盤內（例如 {sample}）")
    return problems


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    assets_dir = Path(argv[0]) if argv else ROOT / "assets"
    palette_set = {(r << 16) | (g << 8) | b for r, g, b in load_palette()}
    if len(palette_set) > 64:
        print(f"調色盤有 {len(palette_set)} 色，超過 64 色")
        return 1
    files = sorted(assets_dir.rglob("*.png"))
    failed = 0
    for f in files:
        problems = check_file(f, palette_set, assets_dir)
        if problems:
            failed += 1
            for p in problems:
                print(f"{f.relative_to(assets_dir.parent)}: {p}")
    print(f"檢查了 {len(files)} 張圖，{failed} 張有問題")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
