// 像素圖。角色為 16×20 完整繪製；敵人以「左半邊」字串定義後自動鏡像。
import { ENEMIES, BOSSES, SKINS } from './data.js';

const BASE = { k: '#16121f', s: '#f2c49b', S: '#c8916a', e: '#1a1426', w: '#f4f1ea', y: '#ffd34d', g: '#ffe14a', r: '#ff4040', f: '#2a2233' };
const mirror = rows => rows.map(r => r + r.split('').reverse().join(''));

// ---------- 角色 ----------
const PLAYER = {
  knight: {
    pal: { m: '#c9d2e0', M: '#7a8498', L: '#f4f8ff', a: '#4a7bd1', A: '#2b3f7a', y: '#ffd34d', p: '#8a94a8', P: '#4a5468', f: '#2a2a3a' },
    body: [
      '......kyyk......',
      '.....kyyyk......',
      '.....kkmmkk.....',
      '....kmmLmmmk....',
      '...kmLLmmmmMk...',
      '...kmkkkkkkMk...',
      '...kmkekkekMk...',
      '...kmmmmmmmMk...',
      '....kMMmmMMk....',
      '..kkmkaaaaAkmkk.',
      '.kmLMkaLaaAkMmMk',
      '.kmMkaLyyaaAkMk.',
      '..kkaaLayyaAAk..',
      '...kmmmmmmmMk...',
      '...kaaAkkaaAk...',
      '...kaAAkkaAAk...',
    ] },
  ranger: {
    pal: { a: '#3f8f46', A: '#245a2a', L: '#7acf6a', c: '#7a4e2a', C: '#4a2e16', b: '#c08a3a', B: '#7a5420', p: '#6a4a2a', P: '#3a2814', f: '#2a1f14' },
    body: [
      '................',
      '......kkkk......',
      '.....kaaaak.....',
      '....kaLaaaAk....',
      '...kaLaaaaaAk...',
      '...kaksssskAk...',
      '...kakessekAk...',
      '...kaksSSskAk...',
      '...kAAkkkkAAk...',
      '..kcAaaLaaaAck..',
      '.kcckabbbbaAcck.',
      '.kcCkaaLaaaAkCk.',
      '.kCCksaaaaaskCk.',
      '..kCkBbbbbbBkCk.',
      '...kkaaaAaaAkk..',
      '....kaaAkaaAk...',
    ] },
  mage: {
    pal: { a: '#7b3fc4', A: '#3a1f66', L: '#a87ce8', y: '#ffd34d', h: '#c8c8d8', w: '#f4f1ea', p: '#3a1f66', P: '#24123f', f: '#16121f' },
    body: [
      '........kk......',
      '.......kaLk.....',
      '......kaLyk.....',
      '.....kaLaaAk....',
      '....kaLaaaaAk...',
      '..kkkkkkkkkkkkk.',
      '....khsssssshk..',
      '....khsesseshk..',
      '....khwwwwwwhk..',
      '...kAkwwwwwwkAk.',
      '..kaaAkwwwwkAaak',
      '..ksLaayyaaaAsk.',
      '...kLaaayaaaAk..',
      '...kaLaaaaaAAk..',
      '..kaLaaaaaaaAAk.',
      '..kkkkkkkkkkkkk.',
    ] },
  cleric: {
    pal: { a: '#efe8d6', A: '#b8ae98', L: '#ffffff', y: '#e0b030', h: '#d9a55a', H: '#a87838', p: '#b8ae98', P: '#8a8070', f: '#6a4a2a' },
    body: [
      '.....yyyyyy.....',
      '....y......y....',
      '.....kkkkkk.....',
      '....khhHhhhk....',
      '...khhhhhhhHk...',
      '...khssssssHk...',
      '...khsessesHk...',
      '...kHsssSssHk...',
      '....kkSSSSkk....',
      '..kkaaayyaaAkk..',
      '.kaLkaayyaaAkAk.',
      '.kskaLaayaaAAksk',
      '...kaLaayaaaAk..',
      '...kaLaayaaaAk..',
      '..kaLaaayaaaAAk.',
      '..kyyyyyyyyyyyk.',
    ] },
};
const LEGS = [
  ['....kpPk.kpPk...', '....kpPk.kpPk...', '....kpPk.kpPk...', '...kffk..kffk...'],
  ['...kpPk..kpPk...', '..kpPk....kpPk..', '..kpPk.....kpPk.', '.kffk......kffk.'],
  ['....kpPkkpPk....', '....kpPkkpPk....', '....kpPkkpPk....', '...kffkkffk.....'],
];

// ---------- 敵人（左半邊）----------
const TPL = {
  slime: ['.......', '....kkk', '..kkLLL', '.kLLaaa', '.kLwaaa', 'kLaaaaa', 'kaaeeaa', 'kaakeaa', 'kaaaaaa', 'kAaaaaa', 'kAAaaaa', '.kAAAAA', '..kkkkk'],
  bat: ['........', 'kk......', 'kAk...kk', 'kAak.kaa', 'kAaakaLa', 'kAaaaaee', '.kAaaaaa', '..kAkaaa', '...k.kAk', '......k.'],
  skel: ['.....kkk', '....kwww', '...kwwww', '...kwkkw', '...kwkgk', '...kwwww', '....kwkw', '.....kkk', '...kkkww', '..kwkwkw', '..kwkwkk', '..k.kwkw', '....kwww', '....kwkk', '....kwk.', '...kkk..'],
  brute: ['........', '....kkkk', '...kaaaa', '..kaLaaa', '..kaaAre', '..kaaaaa', '..kawaaa', '...kAAAA', '.kkbbbbb', 'kaabBbbb', 'kaabbbBb', 'kAakbbbb', '.kkkbbbb', '...kAAkk', '...kAAk.', '...kkkk.'],
  shroom: ['....kkkk', '..kkaaaa', '.kaawaaa', 'kaLaaaaw', 'kawaaaaa', 'kAaaaaaa', 'kkkkkkkk', '...kbbbb', '...kbebb', '...kbbbb', '...kbbBb', '...kbbbb', '....kBBB', '.....kkk'],
  ghost: ['....kkk', '..kkLLL', '.kLLaaa', '.kLaaaa', 'kLaeeaa', 'kaaeeaa', 'kaaaaaa', 'kaaaaka', 'kaaaaaa', 'kAaaaaa', 'kAaaaaa', 'kAAaAaa', 'kAkAkAk', 'k.k.k.k'],
  spider: ['........', 'k......k', 'kk...kkk', '.kk.kaaa', '..kkaLaa', 'kkkaaaee', '..kkAaaa', '.kk.kAAA', 'kk...kkk', 'k.......'],
  eye: ['...kkkk', '.kkaaaa', '.kaLwww', 'kaLwwww', 'kawwbbb', 'kawbbee', 'kawbbee', 'kawwBbb', 'kaAwwww', '.kAAwww', '.kkAAAA', '..kakka', '..ka.ka', '..k..k.'],
  imp: ['..k.....', '..kk....', '..kak.kk', '...kakaa', '...kaaaa', '...kaaye', '...kaaaa', '....kaww', '..kkkaaa', '.kaLkaaa', 'kaLakaAa', 'k.kAkaaa', '...kakAa', '...kk.kk'],
  wisp: ['....k.', '...kgk', '..kgLk', '.kgLga', '.kgaaa', 'kgaaLa', 'kaaeaa', 'kaaeaa', 'kAaaaa', '.kAaaa', '..kAAA', '...kkk'],
  worm: ['...kkkk', '..kaLaa', '.kaLaee', '.kaaakk', '.kAawwk', '..kAkkk', '..kbbbk', '.kbBbbb', '.kbbbBb', '..kbbbb', '.kbBbbb', 'kkkkkkk'],
  armor: ['.....kkk', '....kmmm', '...kmLmm', '...kmkkk', '...kmkgk', '...kmmmm', '..kkkMMM', '.kmmkaaa', 'kmLmkaLa', 'kmmmkaaa', 'kMmmkaaa', '.kkkkMMM', '....kmmm', '....kmMk', '....kmMk', '...kkkkk'],
  crystal: ['.....k', '....kL', '...kLa', '...kLa', '..kLaa', '..kLag', '.kLaag', '.kLaaa', 'kLaaaA', '.kAaAA', '..kAAA', '.kmmmm', 'kmMmMm', 'kkkkkk'],
  plant: ['.kk..kk', 'kaak.ka', 'kaLakaa', '.kaakbb', '..kkbeb', '.kaakbb', 'kaLakaa', 'kaak.kk', '.kk..kg', '....kgg', '..kgkgg', '.kgGkgk', '..kk.kk', '...kkkk'],
  beetle: ['..k.....', '...k..kk', '....kkaa', '...kaLLa', '..kaLaaa', '.kaLaaaA', '.kaaaaAk', 'kaaaaaAk', 'kAaaaaAk', '.kAaaAAk', 'k.kkkkkk', '..k..k..'],
  robe: ['.....kkk', '....kaaa', '...kaLaa', '...kakkk', '...kakkg', '...kakkk', '...kAaaa', '..kaaLaa', '.kaaLaaa', '.kskaaaa', '..kaaLaa', '..kaaaaa', '.kaaaaaa', '.kAAAAAA', '.kkkkkkk'],
  bomb: ['......', '.....k', '....ky', '....kk', '..kkkk', '.kaaaa', 'kaLLaa', 'kaLaaa', 'kaaaew', 'kaaaaa', '.kAaaa', '..kkkk'],
  mimic: ['.kkkkk', 'kbbbbb', 'kbyyyy', 'kwkwkw', 'krrrrr', 'krrrrr', 'kwkwkw', 'kbbbby', 'kBbbbb', 'kkkkkk', '.k..k.'],
  // 頭目（2 倍繪製）
  golem: ['....kkkk', '...kaaaa', '..kaaaaa', '..kaggaa', '..kaaaaa', '.kkAAAAA', 'kaakaaaa', 'kaaakaga', 'kaaakaaa', 'kAaakaag', '.kAkkaaa', '..k.kaaa', '....kaAA', '...kaakk', '...kaak.', '...kkkk.'],
  dragon: ['........', '.k....kk', 'kWk..kaa', 'kWWkkaaa', 'kWWWkaga', 'kWWWkaaa', '.kWWkaaa', '..kWkayy', '...kkayy', '....kayy', '....kaay', '...kaaaa', '...kakka', '..kak..k', '..kk....', '........'],
  lich: ['......kk', '.....kvv', '....kvvv', '...kvvkk', '...kvkww', '...kvkwg', '...kvkww', '..kvvvkw', '.kvvvvvk', 'kvVvvvvv', 'kvVvvgvv', 'kvVvvvvv', '.kVvvvvv', '.kVVvvvv', '..kVVVVV', '...kkkkk'],
  queen: ['....y.y.', '....yyyy', 'k...kaaa', 'kk.kaLaa', '.kkaLaee', '..kaaaaa', 'kkkkaaaa', '...kAbab', '..kAaaba', '.kAaaaab', 'kkAaaaba', 'k.kAaaab', '..kkAAaa', '.k..kkAA', 'k.....kk', '........'],
  general: ['.k......', '.kk..kkk', '..kkkyyy', '...kwwww', '..kwwwww', '..kwkkww', '..kwkgkw', '..kwwwww', '...kwkwk', '.kkkaaaa', 'kccaaLaa', 'kccaaaya', 'kccaaaaa', 'kcckmmmm', '.kckwkkw', '..kkkk.k'],
  gargoyle: ['........', 'k.....kk', 'kk...kaa', 'kak.kaLa', 'kaakaaaa', 'kaakaagk', 'kaaakaaa', 'kaaakwkw', '.kaakaaa', '..kkaaLa', '...kaaaa', '...kAaaa', '...kAAaa', '...kak.k', '..kak...', '..kk....'],
  shroomKing: ['...y.y.y', '...yyyyy', '....kkkk', '..kkaaaa', '.kaawaaa', 'kaLaaaaw', 'kawaaaaa', 'kAaaaaaa', 'kkkkkkkk', '...kbbbb', '...kbebb', '...kbbbb', '..kbbbBb', '..kbbbbb', '...kBBBB', '....kkkk'],
  demon: ['k.......', 'kk......', '.kk..kkk', '..kkkaaa', '...kaLaa', '..kaaaag', '..kaaaaa', '..kakwkw', '.kkaaaaa', 'kaakaLaa', 'kaaakaaa', 'kAakkaaa', '.kk.kaAa', '....kaAA', '...kaak.', '...kkk..'],
  core: ['....kkkk', '..kkyyyy', '.kyykkkk', '.kykaaaa', 'kykaLggg', 'kykaggww', 'kykaggww', 'kykaLggg', '.kykaaaa', '.kyykkkk', '..kkyyyy', '....kkkk', '...kmmmm', '..kmMmMm', '.kkkkkkk'],
  icequeen: ['...y.y.y', '...yyyyy', '....kkkk', '...khhhh', '..khssss', '..khsess', '..khssss', '..khhkSS', '..khhaaa', '.kaaaLaa', 'kaaaaLya', 'ksaaaaaa', '.kaaaaLa', '.kaaaaaa', 'kaaaaaaa', 'kkkkkkkk'],
  witch: ['......k.', '.....kak', '....kaaa', '...kaaLa', '..kaaaay', 'kkkkkkkk', '..khssss', '..khsess', '..khssss', '...kkaaa', '..kaaaaa', '.kaLwwyw', '.kaawkyw', '.kaawwww', '..kaaaaa', '.kkkkkkk'],
  heart: ['..kkk...', '.kaaak.k', 'kaLaaakk', 'kaLaaaak', 'kaaaaaab', 'kaaabaaa', 'kaaaabaa', '.kaaaaga', '.kaaaaaa', '..kaaaaa', '...kaaaa', '..k.kaaa', '.k...kaa', 'k.....kA', '.......k', '........'],
  banner: ['....k', '...ky', '..kyr', '..kyy', '..kyy', '...ky', '....k', '....k', '....k', '....k', '...kk'],
  egg: ['..kkk', '.kLaa', 'kLaaa', 'kaaba', 'kabaa', 'kaaaa', '.kAaa', '..kkk'],
  root: ['....k', '...ka', '..kaL', '..kaa', '.kaaa', '.kaAa', 'kAaaa', 'kaaAa', 'kkkkk'],
  phyl: ['..kkk', '.kggg', 'kgLgg', 'kgggg', '.kggg', '..kkk', '..kmm', '.kmMm', 'kkkkk'],
  voidlord: ['..y..y..', '..yy.yy.', '...yyyyy', '...kkkkk', '.kkaaaaa', 'kaaLwwww', 'kaLwwbbb', 'kawwbbee', 'kawwbbee', 'kaawwbbb', 'kAaawwww', '.kAAaaaa', '..kkAkAA', '.kA.kA.k', 'kA..kA..', 'k...k...'],
};
const BOSS_PAL = {
  general: { w: '#e9e6dc', a: '#5a5a6e', L: '#8a8aa0', c: '#8a1a2a', m: '#ffd34d', g: '#ff4a3a' },
  gargoyle: { a: '#7a7a8a', A: '#4a4a58', L: '#a8a8b8', g: '#ff3a3a' },
  gargoyle2: { a: '#6a7a8a', A: '#3a4a58', L: '#98a8b8', g: '#4ad8ff' },
  flowerKing: { a: '#c82a6a', A: '#6a1038', L: '#ff7ab0', b: '#ffd34d', g: '#3a8a2a', G: '#1f5a14' },
  shroomKing: { a: '#9a3ad8', A: '#5a1a8a', L: '#d08aff', b: '#e8d6b0', B: '#b0a080' },
  demon: { a: '#c8301a', A: '#6a1408', L: '#ff7a3a', g: '#ffe14a', w: '#ffffff' },
  core: { a: '#5a2418', L: '#a8401a', g: '#ff8a2a', w: '#fff0a0', y: '#ffd34d', m: '#4a4040', M: '#2a2020' },
  icequeen: { a: '#8fd8ff', A: '#3a8ab8', L: '#e8f8ff', y: '#e8f8ff', h: '#ffffff', s: '#d8e8f8', S: '#a8c0d8' },
  deathknight: { m: '#5a6a7a', M: '#2a3440', L: '#a8c0d8', a: '#5ff2ff', g: '#5ff2ff' },
  witch: { a: '#3a2a6e', A: '#1f1440', L: '#6a5ab0', y: '#ffd34d', w: '#f0e8ff', h: '#e8e0f0' },
  heart: { a: '#8a1a4a', A: '#4a0a24', L: '#e04a8a', b: '#3a0a1a', g: '#ff4af0' },
  golem: { a: '#8b8d99', A: '#5a5c68', g: '#5ff2ff' },
  dragon: { a: '#d8452a', W: '#8a3a6a', y: '#ffc04a', g: '#ffe14a' },
  lich: { v: '#3a6a9a', V: '#1a3a5a', w: '#e9e6dc', g: '#5ff2ff' },
  queen: { a: '#3a2a4a', A: '#1f1428', L: '#6a5080', b: '#9be04a', e: '#ff4040', y: '#ffd34d' },
  voidlord: { a: '#4a2a6e', A: '#1f0f38', L: '#8a5ac8', w: '#f0e0ff', b: '#ff4af0', e: '#1a0a20', y: '#ffd34d' },
};

// ---------- 物件 ----------
const OBJ = {
  chest: { pal: { b: '#9a5b2a', B: '#5a3014', y: '#ffd34d' }, rows: ['......', '.kkkkk', 'kbbbbb', 'kbyyyy', 'kkkkkk', 'kbbbby', 'kBbbby', 'kBbbbb', 'kkkkkk'] },
  chestOpen: { pal: { b: '#9a5b2a', B: '#5a3014', y: '#ffd34d' }, rows: ['.kkkkk', 'kbbbbb', 'kkkkkk', 'k.....', 'kyyyyy', 'kbbbby', 'kBbbby', 'kBbbbb', 'kkkkkk'] },
  potion: { pal: { r: '#ff3d5a', w: '#ffffff' }, rows: ['..kk', '..kw', '.kkk', 'krrr', 'krwr', 'krrr', 'krrr', '.kkk'] },
  crystal: { pal: { b: '#4aa8ff', w: '#d8f0ff' }, rows: ['...k', '..kw', '.kwb', 'kwbb', 'kbbb', '.kbb', '..kb', '...k'] },
  coin: { pal: { o: '#c98a1a' }, rows: ['.kk', 'kyy', 'kyo', 'kyo', 'kyy', '.kk'] },
  cross: { pal: {}, rows: ['..ky', '..ky', 'kkky', 'kyyy', 'kkky', '..ky', '..ky', '..kk'] },
  whet: { pal: { L: '#d0d8e8', a: '#8a94a8', A: '#4a5468' }, rows: ['....', '..kk', '.kLL', 'kLaa', 'kaaa', 'kAAA', '.kkk', '....'] },
  scroll: { pal: { L: '#f4e8c8', a: '#d8c8a0', r: '#ff4a6a' }, rows: ['.kkk', 'kaLL', 'kkLL', '.kLr', '.kLL', '.kLr', 'kkLL', 'kaLL'] },
};

// ---------- 建構 ----------
function toCanvas(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i], col = ch && ch !== '.' ? pal[ch] : null;
    if (!col) continue;
    const n = parseInt(col.slice(1), 16), o = (j * w + i) * 4;
    img.data[o] = n >> 16; img.data[o + 1] = (n >> 8) & 255; img.data[o + 2] = n & 255; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}
function tint(src, color) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function outline(src, color) {
  const c = document.createElement('canvas'); c.width = src.width + 2; c.height = src.height + 2;
  const x = c.getContext('2d'), t = tint(src, color);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) x.drawImage(t, dx, dy);
  x.drawImage(src, 1, 1);
  return c;
}
function set(img) {
  return { n: img, w: tint(img, '#ffffff'), i: tint(img, 'rgba(120,200,255,0.55)'), g: tint(img, 'rgba(40,40,55,0.55)'),
    r: tint(img, 'rgba(255,60,40,0.35)'), p: tint(img, 'rgba(120,255,80,0.3)'), o: outline(img, '#ffd34d') };
}

const cache = new Map();
export function playerSprite(cls, skin = 'default') {
  const key = 'p:' + cls + ':' + skin;
  if (cache.has(key)) return cache.get(key);
  const d = PLAYER[cls] || PLAYER.knight;
  const sk = (SKINS[cls] || []).find(s => s.id === skin) || { pal: {} };
  const pal = { ...BASE, ...d.pal, ...sk.pal };
  const frames = LEGS.map(l => set(toCanvas([...d.body, ...l], pal)));
  cache.set(key, frames);
  return frames;
}
export function enemySprite(type) {
  const key = 'e:' + type;
  if (cache.has(key)) return cache.get(key);
  let s;
  if (BOSSES[type]) { const spr = BOSSES[type].spr; s = set(toCanvas(mirror(TPL[spr]), { ...BASE, m: '#8a94a8', M: '#4a5468', ...(BOSS_PAL[type] || BOSS_PAL[spr]) })); }
  else { const d = ENEMIES[type]; s = set(toCanvas(mirror(TPL[d.spr]), { ...BASE, m: '#8a94a8', M: '#4a5468', b: '#7a5230', B: '#4a3020', ...(d.pal || BOSS_PAL[d.spr]) })); }
  cache.set(key, s);
  return s;
}
export function objSprite(name) {
  const key = 'o:' + name;
  if (cache.has(key)) return cache.get(key);
  const d = OBJ[name];
  const s = set(toCanvas(mirror(d.rows), { ...BASE, ...d.pal }));
  cache.set(key, s);
  return s;
}
