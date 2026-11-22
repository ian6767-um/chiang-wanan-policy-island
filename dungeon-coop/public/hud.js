// HTML HUD：隊伍框、關卡進度、頭目血條、技能冷卻、提示、橫幅、三選一卡片（全部彈性排版，不寫死座標）
import { CLASSES, TAGS, RES, BOON_MAP, SPECIAL, CHAPTERS, STAGES_PER_CHAPTER } from './data.js';
import { heroArt } from './art.js';
import { input, touchBtns } from './input.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const last = new Map();
const put = (el, key, html) => { if (last.get(key) !== html) { last.set(key, html); el.innerHTML = html; } };
const setP = (el, p) => { const v = String(Math.round(p * 100) / 100); if (el.style.getPropertyValue('--p') !== v) el.style.setProperty('--p', v); };
const width = (el, f) => { const v = Math.max(0, Math.min(100, f * 100)).toFixed(1) + '%'; if (el.style.width !== v) el.style.width = v; };

export function tagCounts(ex) {
  const c = {};
  if (ex) for (const [id, l] of ex.b) { const bn = BOON_MAP[id]; if (bn) c[bn.tag] = (c[bn.tag] || 0) + l; }
  return c;
}
function portrait(cls, skin) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'pic';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(heroArt(cls, skin).idle[0], 16, 8, 32, 32, 0, 0, 32, 32);
  return c;
}

// ---------- 隊伍 ----------
let partySig = '';
const pfEls = new Map();
function updateParty(s, exMap, myId) {
  const order = [...s.ps].sort((a, b) => (a.i === myId ? -1 : b.i === myId ? 1 : a.i - b.i));
  const sig = order.map(p => `${p.i}:${p.c}:${p.sk}:${p.n}`).join('|');
  const box = $('party');
  if (sig !== partySig) {
    partySig = sig; box.innerHTML = ''; pfEls.clear();
    for (const p of order) {
      const d = document.createElement('div'); d.className = 'pf' + (p.i === myId ? ' me' : ''); d.style.setProperty('--c', CLASSES[p.c].color);
      d.appendChild(portrait(p.c, p.sk));
      d.insertAdjacentHTML('beforeend', `<div class="nm"><b>${esc(p.n)}</b><span>${CLASSES[p.c].name}</span></div>
        <div class="bar hp"><i></i></div><div class="bar sh"><i></i></div><div class="tags"></div>`);
      box.appendChild(d);
      pfEls.set(p.i, { d, hp: d.querySelector('.hp i'), sh: d.querySelector('.sh i'), tags: d.querySelector('.tags') });
    }
  }
  for (const p of order) {
    const el = pfEls.get(p.i); if (!el) continue;
    width(el.hp, p.hp / p.mh);
    width(el.sh, (p.sh + p.br) / p.ms);
    el.sh.style.background = p.br > 0 ? '#ffd34d' : '';
    el.d.classList.toggle('down', !!p.dn);
    const tc = tagCounts(exMap.get(p.i));
    put(el.tags, 'tags' + p.i, Object.keys(TAGS).filter(t => tc[t]).map(t => {
      const tier = RES[t].filter(r => tc[t] >= r.n).length;
      return `<span class="tag" style="background:${tier ? TAGS[t].color : 'rgba(255,255,255,.2)'}">${TAGS[t].icon}${tc[t]}</span>`;
    }).join('') + (exMap.get(p.i) ? `<span class="tag" style="background:#8ad0ff">武${exMap.get(p.i).wl}</span>` : ''));
  }
}

// ---------- 關卡進度 ----------
function updateStage(s, room) {
  if (s.st === 'hub') {
    const rd = s.ps.filter(p => p.rd).length;
    put($('stage'), 'stage', `<div class="ttl">冥界聖殿</div><div class="gold">準備 ${rd} / ${s.ps.length}　·　站上傳送陣並準備即可出發</div>`);
    return;
  }
  const ch = CHAPTERS[s.cp - 1];
  let nodes = '';
  for (let i = 1; i <= STAGES_PER_CHAPTER; i++) nodes += `<i class="${i < s.sg ? 'done' : i === s.sg ? 'cur' : ''}${i === STAGES_PER_CHAPTER ? ' bs' : ''}"></i>`;
  put($('stage'), 'stage', `<div class="ttl">第 ${s.cp} 章 · ${ch.name}</div><div class="nodes">${nodes}</div><div class="gold">金幣 ${s.g}</div>`);
}

// ---------- 頭目血條 ----------
function updateBoss(s) {
  const box = $('bossBars');
  if (!s.bs || !s.bs.length) { put(box, 'boss', ''); return; }
  const sig = s.bs.map(b => b.i).join(',');
  if (last.get('bossSig') !== sig) {
    last.set('bossSig', sig);
    box.innerHTML = s.bs.map(b => `<div class="boss" data-i="${b.i}"><div class="top"><span></span><span class="num"></span></div>
      <div class="bar hp"><i></i></div><div class="bar sg"><i></i></div><div class="bar gg hidden"><i></i></div><div class="ms"></div></div>`).join('');
    last.delete('boss');
  }
  for (const b of s.bs) {
    const el = box.querySelector(`[data-i="${b.i}"]`); if (!el) continue;
    const name = el.querySelector('.top span'), num = el.querySelector('.num');
    const nm = b.n + (b.rg ? '（狂暴）' : ''); if (name.textContent !== nm) name.textContent = nm;
    const nt = `${b.hp} / ${b.mh}（${Math.ceil(b.hp / b.mh * 100)}%）`; if (num.textContent !== nt) num.textContent = nt;
    width(el.querySelector('.hp i'), b.hp / b.mh);
    width(el.querySelector('.sg i'), b.sg);
    const gg = el.querySelector('.gg'); gg.classList.toggle('hidden', b.gg == null); if (b.gg != null) width(gg.querySelector('i'), b.gg);
    el.classList.toggle('imm', b.im === 1); el.classList.toggle('half', b.im === 2);
    const ms = b.st ? '破綻！傷害 ×1.5' : b.ms || '硬直值'; const m = el.querySelector('.ms'); if (m.textContent !== ms) m.textContent = ms;
  }
}

// ---------- 技能冷卻（PC 動作列與手機扇形按鈕共用） ----------
let actBuilt = false;
const actEls = {};
function updateActions(me) {
  if (!actBuilt) {
    actBuilt = true;
    const defs = [['fire', '攻', '左鍵'], ['dodge', '翻', '空白'], ['skill', '技', 'E'], ['ult', '招', 'Q']];
    $('actionBar').innerHTML = defs.map(([k, l, key]) => `<div class="act" data-k="${k}"><span class="k">${key}</span>${l}<i class="cd"></i><b class="n"></b></div>`).join('');
    for (const [k] of defs) actEls[k] = $('actionBar').querySelector(`[data-k="${k}"]`);
  }
  if (!me) return;
  const vals = {
    fire: { p: 1, n: me.c === 'hunter' ? '' : `${me.cb + 1}` },
    dodge: { p: me.dc >= me.dm2 ? 1 : me.dcd, n: me.dc, ready: me.dc > 0 },
    skill: { p: me.sc >= me.sm ? 1 : me.scd, n: me.sc, ready: me.sc > 0 },
    ult: { p: me.uc >= me.um ? 1 : me.ue, n: me.uc, ready: me.uc > 0 },
  };
  for (const k of Object.keys(vals)) for (const el of [actEls[k], touchBtns[k]]) {
    if (!el) continue;
    const v = vals[k], cd = el.querySelector('.cd'), n = el.querySelector('.n');
    setP(cd, k === 'fire' ? 1 : v.n > 0 && k !== 'ult' ? 1 : v.p);
    if (k === 'ult') setP(cd, v.n > 0 ? 1 : v.p);
    const t = String(v.n ?? ''); if (n.textContent !== t) n.textContent = t;
    el.classList.toggle('ready', !!v.ready);
  }
}

// ---------- 互動提示 ----------
function updateHint(s, me) {
  let h = '';
  const key = input.mode === 'mobile' ? '互動鍵' : 'F';
  if (me && !me.dn && !me.dd) {
    const near = (o, r) => Math.hypot(o.x - me.x, o.y - me.y) < r;
    const obj = s.ob.find(o => near(o, o.k === 'portal' ? 36 : 22));
    const down = s.ps.find(p => p.dn && p.i !== me.i && near(p, 30));
    if (down) h = `長按 ${key} 救援 ${esc(down.n)}`;
    else if (obj) {
      if (obj.k === 'classAltar') h = obj.cl === me.c ? `目前職業：${CLASSES[obj.cl].name}` : `按 ${key} 化身為 ${CLASSES[obj.cl].name}（${CLASSES[obj.cl].role}）`;
      else if (obj.k === 'wardrobe') h = `按 ${key} 開啟鏡像衣櫃切換造型`;
      else if (obj.k === 'portal') h = me.rd ? `已準備，等待隊友…（按 ${key} 取消）` : `按 ${key} 準備出發`;
      else if (['chest', 'pedestal', 'anvil', 'altar'].includes(obj.k) && !obj.o) h = `長按 ${key} 使用`;
    } else if (s.dr) h = '全員站到同一扇門前，決定下一個關卡';
  } else if (me && me.dn) h = '你化為靈魂火炬了，移動到隊友身邊等待救援';
  put($('hint'), 'hint', h);
}

export function updateHud(s, exMap, myId, roomCode) {
  const me = s.ps.find(p => p.i === myId);
  updateParty(s, exMap, myId);
  updateStage(s);
  updateBoss(s);
  updateActions(me);
  updateHint(s, me);
  put($('roomTag'), 'room', `房號 ${roomCode || '----'}`);
}

// ---------- 橫幅與中央訊息 ----------
export function banner(msg, col = '#fff') {
  const box = $('banners'), el = document.createElement('div');
  el.className = 'banner'; el.style.color = col; el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3200);
}
let centerT = null;
export function center(msg, col = '#ff5a5a', ms = 2200) {
  const el = $('center'); el.textContent = msg; el.style.color = col;
  clearTimeout(centerT); if (ms) centerT = setTimeout(() => { el.textContent = ''; }, ms);
}

// ---------- 三選一 ----------
let choiceSig = '';
export function renderChoice(ex, onPick, onReroll) {
  const modal = $('choiceModal');
  if (!ex || !ex.c) { if (choiceSig) { choiceSig = ''; modal.classList.add('hidden'); } return; }
  const sig = JSON.stringify(ex.c) + ex.rr;
  if (sig === choiceSig) return;
  choiceSig = sig;
  const tc = tagCounts(ex);
  $('choiceTitle').textContent = ex.c.r === 'rare' ? '選擇一個強化增幅（等級 +2）' : '選擇一個增幅';
  const box = $('choiceCards'); box.innerHTML = '';
  ex.c.o.forEach(([id, g], i) => {
    const bn = BOON_MAP[id], sp = SPECIAL[id], tag = bn ? TAGS[bn.tag] : null;
    const have = bn ? ((ex.b.find(x => x[0] === id) || [0, 0])[1]) : 0, nl = bn ? Math.min(bn.max, have + g) : 0;
    const card = document.createElement('button');
    card.className = 'card'; card.style.setProperty('--c', tag ? tag.color : '#ffd34d');
    let res = '';
    if (bn) {
      const cur = tc[bn.tag] || 0, after = cur + (nl - have), next = RES[bn.tag].find(r => r.n > cur);
      res = `<p class="res${next && after >= next.n ? ' hit' : ''}">${tag.name}共鳴 ${cur} → ${after}${next ? `｜${next.n}：${esc(next.desc)}` : '（已全部觸發）'}</p>`;
    }
    card.innerHTML = `<div class="head"><span>${tag ? `${tag.icon}・${tag.name}` : '特殊'}</span><span>${g > 1 ? '強化 +' + g : i + 1}</span></div>
      <div class="ttl"><b>${esc(bn ? bn.name : sp.name)}</b><span class="lv">${bn ? (have ? `Lv${have} → Lv${nl}` : `Lv${nl}`) : ''}</span></div>
      <p>${esc(bn ? bn.desc(nl) : sp.desc())}</p>${res}`;
    card.onclick = () => onPick(i);
    box.appendChild(card);
  });
  const rr = $('btnReroll');
  rr.classList.toggle('hidden', !ex.rr); rr.textContent = `重擲（剩 ${ex.rr} 次）`; rr.onclick = onReroll;
  modal.classList.remove('hidden');
}
