"""美術流水線與資產檢查的測試：python3 -m unittest discover -s tests/tools"""
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import check_assets  # noqa: E402
import pixel_pipeline  # noqa: E402
from palette import load_palette, darkest_in_ramp, RAMPS  # noqa: E402


class PaletteTest(unittest.TestCase):
    def test_palette_is_62_colors_and_matches_ramps(self):
        pal = load_palette()
        self.assertEqual(len(pal), 62)
        self.assertLessEqual(len(pal), 64)
        ramp_colors = {c for r in RAMPS for c in r}
        hexes = {"%02x%02x%02x" % c for c in pal}
        self.assertEqual(hexes, ramp_colors)

    def test_darkest_in_ramp(self):
        self.assertEqual(darkest_in_ramp((0xe0, 0x8a, 0x3a)), (0x7a, 0x32, 0x14))
        self.assertIsNone(darkest_in_ramp((1, 2, 3)))


class PipelineTest(unittest.TestCase):
    def make_fake_ai_image(self, path):
        # 模擬 AI 生成圖：64x32 的像素圖被放大 8 倍，再加一點雜訊與半透明邊緣
        rng = np.random.default_rng(1)
        small = np.zeros((32, 64, 4), np.uint8)
        small[8:24, 8:56] = (230, 140, 60, 255)  # 接近小卷貓橘
        small[13:20, 41:50] = (30, 60, 100, 255)  # 奇數位置的邊緣，讓格子大小只可能是 8
        big = np.kron(small, np.ones((8, 8, 1), np.uint8)).astype(np.int16)
        big[:, :, :3] += rng.integers(-6, 7, big[:, :, :3].shape)
        big = np.clip(big, 0, 255).astype(np.uint8)
        big[60:70, 60:70, 3] = 120
        Image.fromarray(big, "RGBA").save(path)

    def test_pipeline_output_passes_check(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            src = d / "ai.png"
            self.make_fake_ai_image(src)
            self.assertEqual(pixel_pipeline.detect_cell(Image.open(src).convert("RGB")), 8)
            out = d / "assets" / "fish" / "codex" / "test.png"
            pixel_pipeline.main([str(src), "--size", "128x64", "--type", "sprite", "--out", str(out)])
            self.assertTrue(out.with_suffix(".json").exists())
            img = np.asarray(Image.open(out).convert("RGBA"))
            self.assertEqual(img.shape[:2], (64, 128))
            self.assertTrue(set(np.unique(img[:, :, 3]).tolist()) <= {0, 255})
            self.assertEqual(check_assets.main([str(d / "assets")]), 0)

    def test_check_assets_flags_bad_files(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "icons").mkdir()
            bad = np.zeros((15, 16, 4), np.uint8)
            bad[:, :] = (1, 2, 3, 128)
            Image.fromarray(bad, "RGBA").save(d / "icons" / "bad.png")
            self.assertEqual(check_assets.main([str(d)]), 1)

    def test_background_dither_uses_only_palette(self):
        grad = np.zeros((360, 800, 3), np.uint8)
        grad[:, :, 2] = np.linspace(80, 240, 360)[:, None]
        grad[:, :, 1] = np.linspace(40, 200, 360)[:, None]
        q = pixel_pipeline.quantize(grad, load_palette(), dither=True)
        pal = {tuple(c) for c in load_palette()}
        self.assertTrue({tuple(c) for c in q.reshape(-1, 3).tolist()} <= pal)

    def test_remove_orphans(self):
        rgb = np.zeros((5, 5, 3), np.uint8)
        rgb[:, :] = (0x47, 0xb3, 0xc2)
        rgb[2, 2] = (0xc8, 0x40, 0x2f)
        alpha = np.full((5, 5), 255, np.uint8)
        out, n = pixel_pipeline.remove_orphans(rgb, alpha)
        self.assertEqual(n, 1)
        self.assertEqual(tuple(out[2, 2]), (0x47, 0xb3, 0xc2))


class RepoAssetsTest(unittest.TestCase):
    def test_repo_assets_pass(self):
        self.assertEqual(check_assets.main([str(ROOT / "assets")]), 0)


if __name__ == "__main__":
    unittest.main()
