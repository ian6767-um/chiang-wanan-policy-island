// 像素圖：以「左半邊」字串定義，自動鏡像成對稱的精靈圖
const BASE = { k: '#16121f', s: '#f2c49b', e: '#1a1426', w: '#f4f1ea', y: '#ffd34d', h: '#b9793f' };
const mirror = rows => rows.map(r => r + r.split('').reverse().join(''));
const LEGS = [['...kbk', '...kk.'], ['..kbk.', '..kk..']];

const DEF = {
  knight: { pal: { m: '#c9d2e0', a: '#4a7bd1', b: '#2b3f7a' }, body: [
    '...kkk', '..kmmm', '.kmmmm', '.kmkkk', '.kmkwk', '.kmmmm', '..kkkk', '.kaabm', 'kaaabm', 'kmkaaa', '.k.kaa', '...kbb'] },
  ranger: { pal: { a: '#3f8f46', b: '#5a3b22' }, body: [
    '....kk', '...kaa', '..kaaa', '..kaes', '..kass', '..kkas', '.kaakk', 'kaaabb', 'ksabaa', '.k.kaa', '...kbb', '...kaa'] },
  mage: { pal: { a: '#7b3fc4', b: '#3a1f66' }, body: [
    '.....k', '....ka', '...kay', '..kaaa', '.kkkkk', '..kses', '..ksss', '.kakkk', 'kaaaay', 'ksaaaa', '.k.kaa', '...kaa'] },
  cleric: { pal: { a: '#efe8d6', b: '#c9962a', h: '#d9a55a' }, body: [
    '....yy', '...kkk', '..khhh', '..kses', '..ksss', '..kkaa', '.kaaab', 'kaaaab', 'ksaabb', '.k.kaa', '...kaa', '...kaa'] },
};

const ENEMY_DEF = {
  slime: { pal: { g: '#5ccf5c', G: '#2f8f3f' }, rows: ['......', '......', '......', '....kk', '..kkgg', '.kgwgg', '.kgggg', 'kggegg', 'kggggg', 'kGgggg', '.kGGGG', '..kkkk'] },
  bat: { pal: { p: '#7a4fa0', r: '#ff4040' }, rows: ['......', '......', 'kk....', 'kpk..k', 'kppkkp', 'kppprp', '.kpppp', '..kpkp', '..k.k.', '......', '......', '......'] },
  skel: { pal: { w: '#e9e6dc', e: '#2a1d36' }, rows: ['....kk', '...kww', '..kwww', '..kwew', '..kwww', '...kwk', '....kk', '..kkww', '.kw.kw', '.k..kw', '....kw', '...kw.'] },
  orc: { pal: { o: '#6aa84f', O: '#3f6b2e', r: '#ff4a3a', t: '#f4f1ea', a: '#7a5230', b: '#4a3020' }, rows: [
    '...kkkk', '..koooo', '.kooooo', '.korrOo', '.kooooo', '.ktooot', '..kOOOO', '.kaaaaa', 'kooaaaa', 'kooabaa', 'kookaaa', '.kkkaaa', '...kaak', '...kOOk'] },
  shroom: { pal: { r: '#d8443c', w: '#f4f1ea', c: '#e8d6b0' }, rows: ['...kkk', '..krrr', '.krwrr', 'krrrrw', 'krwrrr', 'kkkkkk', '..kccc', '..kcec', '..kccc', '..kccc', '...kcc', '....kk'] },
  golem: { pal: { q: '#8b8d99', Q: '#5a5c68', c: '#5ff2ff' }, rows: [
    '....kkkk', '...kqqqq', '..kqqqqq', '..kqccqq', '..kqqqqq', '.kkQQQQQ', 'kqqkqqqq', 'kqqqkqcq', 'kqqqkqqq', 'kQqqkqqc', '.kQkkqqq', '..k.kqqq', '....kqQQ', '...kqqkk', '...kqqk.', '...kkkk.'] },
  dragon: { pal: { d: '#d8452a', D: '#8a2418', y: '#ffc04a', W: '#8a3a6a', e: '#ffe14a' }, rows: [
    '........', '.k....kk', 'kWk..kdd', 'kWWkkddd', 'kWWWkded', 'kWWWkddd', '.kWWkddd', '..kWkdyy', '...kkdyy', '....kdyy', '....kddy', '...kdddd', '...kdkkd', '..kdk..k', '..kk....', '........'] },
  lich: { pal: { v: '#4a2a6e', V: '#2c1846', w: '#e9e6dc', g: '#7dff6a' }, rows: [
    '......kk', '.....kvv', '....kvvv', '...kvvkk', '...kvkww', '...kvkwg', '...kvkww', '..kvvvkw', '.kvvvvvk', 'kvVvvvvv', 'kvVvvgvv', 'kvVvvvvv', '.kVvvvvv', '.kVVvvvv', '..kVVVVV', '...kkkkk'] },
  chest: { pal: { b: '#9a5b2a', y: '#ffd34d' }, rows: ['......', '.kkkkk', 'kbbbbb', 'kbyyyy', 'kkkkkk', 'kbbbby', 'kbbbby', 'kbbbbb', 'kkkkkk'] },
  bigchest: { pal: { b: '#5a6ad8', y: '#ffd34d' }, rows: ['......', '.kkkkk', 'kbbbbb', 'kbyyyy', 'kkkkkk', 'kbbbby', 'kbbbby', 'kbbbbb', 'kkkkkk'] },
  potion: { pal: { r: '#ff3d5a', w: '#ffffff' }, rows: ['..kk', '..kw', '.kkk', 'krrr', 'krwr', 'krrr', 'krrr', '.kkk'] },
  crystal: { pal: { b: '#4aa8ff', w: '#d8f0ff' }, rows: ['...k', '..kw', '.kwb', 'kwbb', 'kbbb', '.kbb', '..kb', '...k'] },
  coin: { pal: { y: '#ffd34d', o: '#c98a1a' }, rows: ['.kk', 'kyy', 'kyo', 'kyo', 'kyy', '.kk'] },
};

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
function set(img) { return { n: img, w: tint(img, '#ffffff'), i: tint(img, 'rgba(120,200,255,0.55)'), g: tint(img, 'rgba(40,40,55,0.55)'), r: tint(img, 'rgba(255,60,40,0.35)') }; }

export function buildSprites() {
  const S = { players: {}, enemies: {} };
  for (const [cls, d] of Object.entries(DEF)) {
    const pal = { ...BASE, ...d.pal };
    S.players[cls] = LEGS.map(l => set(toCanvas(mirror([...d.body, ...l]), pal)));
  }
  for (const [k, d] of Object.entries(ENEMY_DEF)) S.enemies[k] = set(toCanvas(mirror(d.rows), { ...BASE, ...d.pal }));
  return S;
}
