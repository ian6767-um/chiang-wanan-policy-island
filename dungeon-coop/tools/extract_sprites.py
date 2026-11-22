"""從參考圖（tools/ref/*.jpg）切出角色與頭目，去背後縮成遊戲用像素圖，輸出到 public/assets/sprites/。
用法：pip install opencv-python-headless pillow numpy && python3 tools/extract_sprites.py [--debug 目錄]"""
import sys, os, json
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'assets', 'sprites')
DEBUG = sys.argv[sys.argv.index('--debug') + 1] if '--debug' in sys.argv else None

# (輸出名稱, 來源, 裁切框 x0,y0,x1,y1, 目標高度 px)
HEROES = {
    'blade_styx': (60, 35, 310, 175), 'blade_thunder': (430, 35, 660, 180), 'blade_sun': (760, 30, 1030, 175), 'blade_bone': (1120, 35, 1360, 180),
    'star_olympus': (85, 212, 310, 350), 'star_bloodmoon': (440, 205, 610, 350), 'star_frost': (780, 205, 975, 350), 'star_necro': (1120, 205, 1355, 350),
    'aegis_sparta': (65, 385, 262, 538), 'aegis_magma': (440, 390, 650, 540), 'aegis_templar': (780, 385, 1000, 538), 'aegis_tide': (1130, 385, 1350, 540),
    'hunter_moon': (80, 585, 305, 728), 'hunter_phoenix': (400, 585, 650, 728), 'hunter_cyber': (785, 585, 1000, 728), 'hunter_dune': (1100, 585, 1340, 728),
}
BOSSES = {
    'golem': (30, 45, 250, 250), 'general': (295, 40, 555, 248), 'gargoyle': (565, 70, 702, 242), 'gargoyle2': (688, 55, 832, 242),
    'queen': (835, 50, 1090, 228), 'icequeen': (1180, 55, 1332, 245),
    'dragon': (15, 295, 265, 502), 'flowerKing': (298, 300, 548, 502), 'shroomKing': (578, 300, 802, 502), 'demon': (858, 300, 1082, 502), 'deathknight': (1148, 305, 1348, 502),
    'lich': (110, 555, 242, 724), 'voidlord': (588, 555, 802, 727), 'witch': (868, 555, 1058, 727), 'heart': (1098, 558, 1376, 727),
}
HERO_H, BOSS_H = 48, 92
BOX_OF = {**HEROES, **BOSSES}

# 深色角色在深色背景上很難自動分辨：用橢圓標記身體核心（來源圖座標 cx, cy, rx, ry）
HINTS = {
    'aegis_magma': [(505, 455, 45, 65), (590, 470, 35, 55), (580, 525, 60, 10)],
    'star_bloodmoon': [(530, 300, 38, 55), (525, 238, 20, 22), (575, 250, 12, 12)],
    'star_necro': [(1222, 262, 22, 26), (1215, 300, 18, 22), (1147, 307, 10, 12), (1305, 307, 10, 12), (1317, 232, 10, 12)],
    'hunter_phoenix': [(530, 650, 55, 50), (530, 612, 22, 22), (478, 655, 32, 22), (545, 708, 55, 12)],
    'gargoyle': [(628, 145, 42, 58), (652, 212, 28, 24)],
    'voidlord': [(695, 618, 40, 40)],
    'blade_styx': [(185, 105, 40, 55)],
    'blade_thunder': [(545, 105, 35, 55)],
    'hunter_cyber': [(880, 655, 25, 55)],
    'blade_bone': [(1240, 115, 30, 50)],
}

# 用「提示模式」（MASK）效果較好的角色；其餘用矩形初始化
MASK_MODE = {'aegis_magma', 'star_bloodmoon', 'star_necro', 'hunter_phoenix', 'gargoyle', 'voidlord', 'blade_styx', 'blade_thunder', 'hunter_cyber', 'blade_bone', 'aegis_tide'}

NOSTRIP = {'general', 'aegis_magma'}
STRONG = {'voidlord', 'blade_thunder', 'hunter_moon'}

def strip_background(crop, fg, name):
    if name in NOSTRIP: return fg
    # 用裁切框外圈學背景色，去掉前景中殘留、低飽和且接近背景色的像素
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    h, w = crop.shape[:2]
    band = np.zeros((h, w), bool); band[:6] = band[-6:] = True; band[:, :6] = band[:, -6:] = True
    bg = lab[band.reshape(-1)]
    mu = bg.mean(0); cov = np.cov(bg.T) + np.eye(3) * 4
    inv = np.linalg.inv(cov)
    d = lab - mu
    md = np.sqrt(np.einsum('ij,jk,ik->i', d, inv, d)).reshape(h, w)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    strong = name in STRONG
    bgish = (md < (3.4 if strong else 2.6)) & (hsv[..., 1] < (90 if strong else 70))
    core = np.zeros((h, w), np.uint8)
    for cx, cy, rx, ry in HINTS.get(name, []):
        cv2.ellipse(core, (cx - BOX_OF[name][0], cy - BOX_OF[name][1]), (int(rx * (.35 if strong else .7)), int(ry * (.35 if strong else .7))), 0, 0, 360, 1, -1)
    fg = fg.copy(); fg[bgish & (core == 0)] = 0
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    n, labc, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = stats[1:, cv2.CC_STAT_AREA].max()
        keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= max(25, big * 0.03)]
        fg = np.isin(labc, keep).astype(np.uint8) * 255
    return fg

def cutout(img, box, name):
    x0, y0, x1, y1 = box
    crop = img[y0:y1, x0:x1].copy()
    h, w = crop.shape[:2]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    if name not in MASK_MODE:
        mask = np.zeros((h, w), np.uint8)
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(crop, mask, (4, 4, w - 8, h - 8), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        glow = ((hsv[..., 1] > 120) & (hsv[..., 2] > 120)) | (hsv[..., 2] > 215)
        fg[glow & (cv2.dilate(fg, np.ones((15, 15), np.uint8)) > 0)] = 255
        return crop, strip_background(crop, fg, name)
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    inner = np.zeros((h, w), bool); inner[int(h * .12):int(h * .9), int(w * .15):int(w * .85)] = True
    salient = ((hsv[..., 1] > 90) & (hsv[..., 2] > 70)) | (hsv[..., 2] > 170)
    mask[inner] = cv2.GC_PR_FGD
    mask[salient] = cv2.GC_PR_FGD
    for cx, cy, rx, ry in HINTS.get(name, []):
        cv2.ellipse(mask, (cx - x0, cy - y0), (rx, ry), 0, 0, 360, int(cv2.GC_FGD), -1)
    mask[:3, :] = mask[-3:, :] = cv2.GC_BGD; mask[:, :3] = mask[:, -3:] = cv2.GC_BGD
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(crop, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    glow = ((hsv[..., 1] > 120) & (hsv[..., 2] > 120)) | (hsv[..., 2] > 215)
    near = cv2.dilate(fg, np.ones((11, 11), np.uint8)) > 0
    fg[glow & near] = 255
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if n > 1:
        big = stats[1:, cv2.CC_STAT_AREA].max()
        keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= max(30, big * 0.04)]
        fg = np.isin(lab, keep).astype(np.uint8) * 255
    return crop, strip_background(crop, fg, name)

def to_sprite(crop, fg, target_h):
    ys, xs = np.nonzero(fg)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgb = cv2.cvtColor(crop[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    a = fg[y0:y1, x0:x1]
    s = target_h / (y1 - y0)
    w, h = max(1, round((x1 - x0) * s)), target_h
    # 先預乘 alpha 再以面積平均縮小，避免背景色滲入邊緣
    rgba = np.dstack([rgb.astype(np.float32) * (a[..., None] / 255.0), a.astype(np.float32)])
    small = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_AREA)
    al = small[..., 3]
    col = np.where(al[..., None] > 1, small[..., :3] / np.maximum(al[..., None], 1) * 255, 0)
    # 提高對比與飽和，符合高對比墨影風格
    col = np.clip((col - 128) * 1.12 + 128, 0, 255)
    alpha = np.where(al > 110, 255, 0).astype(np.uint8)
    out = np.dstack([col.astype(np.uint8), alpha])
    # 1px 純黑外框
    solid = alpha > 0
    ring = cv2.dilate(solid.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    ring &= ~solid
    pad = np.zeros((h + 2, w + 2, 4), np.uint8)
    pad[1:-1, 1:-1] = out
    r2 = np.zeros((h + 2, w + 2), bool); r2[1:-1, 1:-1] = ring
    edge = np.zeros((h + 2, w + 2), bool)
    edge[1:-1, 1:-1] |= ring
    pad[edge] = (7, 5, 12, 255)
    # 補上外圈（最外層一格）
    full = pad[..., 3] > 0
    outer = cv2.dilate(full.astype(np.uint8), np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], np.uint8)) > 0
    return Image.fromarray(pad, 'RGBA'), (w + 2, h + 2)

def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for src, table, th in (('heroes.jpg', HEROES, HERO_H), ('bosses.jpg', BOSSES, BOSS_H)):
        img = cv2.imread(os.path.join(HERE, 'ref', src))
        for name, box in table.items():
            crop, fg = cutout(img, box, name)
            spr, size = to_sprite(crop, fg, th)
            spr.save(os.path.join(OUT, name + '.png'))
            meta[name] = size
            if DEBUG:
                os.makedirs(DEBUG, exist_ok=True)
                vis = crop.copy(); vis[fg == 0] = (255, 0, 255)
                cv2.imwrite(os.path.join(DEBUG, name + '_mask.png'), vis)
    # 雙子石像鬼：左邊那隻灰色石像鬼與背景太接近，改用右邊那隻鏡像並分別染成暖色／冷色
    base = Image.open(os.path.join(OUT, 'gargoyle2.png')).convert('RGBA')
    def tint(im, rgb, k):
        a = np.array(im).astype(np.float32); m = a[..., 3] > 0
        a[..., :3][m] = a[..., :3][m] * (1 - k) + np.array(rgb, np.float32) * k * (a[..., :3][m].mean(1, keepdims=True) / 128)
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    tint(base.transpose(Image.FLIP_LEFT_RIGHT), (200, 90, 70), 0.35).save(os.path.join(OUT, 'gargoyle.png'))
    tint(base, (80, 130, 210), 0.35).save(os.path.join(OUT, 'gargoyle2.png'))
    meta['gargoyle'] = meta['gargoyle2']
    with open(os.path.join(OUT, 'index.json'), 'w') as f: json.dump(meta, f, indent=1)
    print('輸出', len(meta), '張精靈圖到', os.path.normpath(OUT))

main()
