"""主調色盤與色階（ramp）定義，pixel_pipeline.py 和 check_assets.py 共用。"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PALETTE_FILE = ROOT / "palette" / "master.hex"

# 與設計文件 4-2 相同的分類；每一組由暗到亮，用來找「同色系最暗的顏色」（sel-out 描邊）
RAMPS = [
    ["0b1d3a", "123a63", "1b5f8c", "2a86a8", "47b3c2", "8fdbd6", "d8f3ee"],  # 深海到淺海
    ["5fa8e0", "8cc7ef", "c4e4f7", "f4f7f2"],  # 白天天空
    ["1a1433", "2e2350", "57376f", "8a4b86", "c4607e", "ef8a7a", "f7b98b", "fde2b0"],  # 夕陽與夜空
    ["1a1820", "2e2b36", "4a4552", "6e6672", "9a8f92"],  # 玄武岩與礁石
    ["8a6e4e", "b89b72", "d9c29a", "efe2c4"],  # 沙灘與咾咕石
    ["1f3a2b", "2f5a3a", "4f7d43", "86a64f", "c9b458"],  # 植物
    ["8c2a22", "c8402f", "e9a23b", "f6d35b"],  # 天人菊與暖色
    ["2a1810", "3b2418", "5e3a24", "8a5a34", "b98450"],  # 木頭與船
    ["6b3f2a", "a8674a", "d99a74", "f2c7a0"],  # 皮膚
    ["7a3214", "b5541e", "e08a3a", "f6c27a", "fff1dc"],  # 小卷貓
    ["2d4f7c", "4f86b8", "a83a4a", "e57a8a", "f1e3c8"],  # 布料
    ["1c1418", "3a2a26", "6b4a3a", "e8d9b8", "fff8ec", "f4c542"],  # UI 與文字
]


def hex_to_rgb(h):
    h = h.strip().lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def load_palette(path=PALETTE_FILE):
    cols = [l.strip() for l in Path(path).read_text().split() if l.strip() and not l.startswith(";")]
    return [hex_to_rgb(c) for c in cols]


def darkest_in_ramp(rgb):
    """回傳與 rgb 同一色階中最暗的顏色；找不到時回傳 None"""
    h = "%02x%02x%02x" % tuple(rgb[:3])
    for ramp in RAMPS:
        if h in ramp:
            return hex_to_rgb(ramp[0])
    return None
