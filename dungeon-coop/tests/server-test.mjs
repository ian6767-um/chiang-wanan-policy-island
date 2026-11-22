// 後端整合測試：帳號 API、4 位數房間、加入防呆
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
const assert = (c, m) => { if (!c) { console.error('✗', m); process.exitCode = 1; } else console.log('✓', m); };
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abyss-'));
const PORT = 3900 + Math.floor(Math.random() * 90);
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, ABYSS_DATA: dir }, stdio: 'pipe' });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('已啟動') && r()));
const base = `http://localhost:${PORT}`;
const post = async (route, body, token) => { const r = await fetch(`${base}/api/${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) }); return { status: r.status, ...(await r.json()) }; };
try {
  const reg = await post('register', { username: 'hero_01', password: 'secret123', nick: '阿明' });
  assert(reg.token && reg.profile.nick === '阿明' && !reg.profile.guest, '註冊帳號');
  assert((await post('register', { username: 'HERO_01', password: 'secret123' })).error === '這個帳號名稱已經有人使用', '重複帳號（不分大小寫）會被拒絕');
  assert((await post('register', { username: 'ab', password: 'secret123' })).status === 400, '帳號格式檢查');
  assert((await post('login', { username: 'hero_01', password: 'wrong!!' })).error === '帳號或密碼錯誤', '密碼錯誤');
  const login = await post('login', { username: 'hero_01', password: 'secret123' });
  assert(login.profile && login.profile.id === reg.profile.id, '登入');
  const guest = await post('guest', {});
  assert(guest.profile.guest && guest.profile.nick.startsWith('遊客'), '遊客快速遊玩');
  const bound = await post('bind', { username: 'guest_up', password: 'pw123456' }, guest.token);
  assert(!bound.profile.guest && bound.profile.id === guest.profile.id, '遊客綁定升級（保留同一個帳號）');
  assert((await post('me', {}, 'bad.token')).error === '請重新登入', '偽造權杖被拒絕');
  const tree = await post('tree', { cls: 'blade', node: 'hp' }, reg.token);
  assert(tree.profile.trees.blade.hp === 1 && tree.profile.crystals < 120, '購買天賦扣除魂晶');
  assert((await post('skin', { cls: 'blade', skin: 'bone' }, reg.token)).error === '魂晶不足', '魂晶不足無法買造型');
  assert(fs.existsSync(path.join(dir, 'accounts.json')) || await new Promise(r => setTimeout(() => r(fs.existsSync(path.join(dir, 'accounts.json'))), 500)), '資料寫入 JSON 檔');

  // WebSocket
  const tokens = [reg.token, guest.token, (await post('guest', {})).token, (await post('guest', {})).token, (await post('guest', {})).token];
  const conn = async token => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const q = [];
    ws.on('message', d => { const m = JSON.parse(d); if (m.t !== 's' && m.t !== 'map') q.push(m); });
    await new Promise(r => ws.on('open', r));
    ws.send(JSON.stringify({ t: 'auth', token }));
    ws.next = async t => { for (let i = 0; i < 100; i++) { const k = q.findIndex(m => m.t === t || m.t === 'err'); if (k >= 0) return q.splice(k, 1)[0]; await new Promise(r => setTimeout(r, 20)); } return null; };
    await ws.next('authok');
    return ws;
  };
  const a = await conn(tokens[0]);
  a.send(JSON.stringify({ t: 'create' }));
  const joined = await a.next('joined');
  assert(/^\d{4}$/.test(joined.code), `建立房間取得 4 位數號碼 ${joined.code}`);
  const others = [];
  for (let i = 1; i < 4; i++) { const w = await conn(tokens[i]); w.send(JSON.stringify({ t: 'join', code: joined.code })); assert((await w.next('joined')) ?.code === joined.code, `第 ${i + 1} 位玩家加入`); others.push(w); }
  const e = await conn(tokens[4]);
  e.send(JSON.stringify({ t: 'join', code: joined.code }));
  assert((await e.next('joined')).msg === '房間已滿（上限 4 人）', '第 5 人：房間已滿');
  const missing = joined.code === '0000' ? '0001' : '0000';
  e.send(JSON.stringify({ t: 'join', code: missing }));
  assert((await e.next('joined')).msg.startsWith('找不到房間'), '房間不存在');
  e.send(JSON.stringify({ t: 'join', code: '12a' }));
  assert((await e.next('joined')).msg === '請輸入 4 位數字的房間號碼', '號碼格式檢查');
  // 一人離開，讓遊戲開始後再嘗試加入
  others[2].send(JSON.stringify({ t: 'leave' })); await others[2].next('left');
  const ready = ws => ws.send(JSON.stringify({ t: 'in', mx: 0, my: 0, a: 0, b: 16 }));
  // 從出生點往上走約 112px 到傳送陣
  for (const ws of [a, others[0], others[1]]) { for (let k = 0; k < 120; k++) { ws.send(JSON.stringify({ t: 'in', mx: 0, my: -1, a: 0, b: 0 })); } }
  await new Promise(r => setTimeout(r, 1250));
  for (const ws of [a, others[0], others[1]]) ws.send(JSON.stringify({ t: 'in', mx: 0, my: 0, a: 0, b: 0 }));
  await new Promise(r => setTimeout(r, 200));
  for (const ws of [a, others[0], others[1]]) ready(ws);
  await new Promise(r => setTimeout(r, 200));
  for (const ws of [a, others[0], others[1]]) ws.send(JSON.stringify({ t: 'in', mx: 0, my: 0, a: 0, b: 0 }));
  await new Promise(r => setTimeout(r, 3600));
  e.send(JSON.stringify({ t: 'join', code: joined.code }));
  const late = await e.next('joined');
  assert(late && late.msg && late.msg.includes('已經開始'), '遊戲開始後加入：明確提示 ' + (late && late.msg));
  for (const w of [a, ...others, e]) w.close();
} finally { srv.kill(); }
