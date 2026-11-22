// 輕量帳號系統：JSON 檔案儲存 + scrypt 密碼雜湊 + HMAC 簽章權杖（不需外部資料庫）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CLASSES, SKINS, TREE, TREE_MAP, defaultSkin, crystalsFor } from '../public/data.js';

const CLS = Object.keys(CLASSES);
const b64u = buf => Buffer.from(buf).toString('base64url');
export class AccountError extends Error {}
const fail = msg => { throw new AccountError(msg); };

export class Accounts {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'accounts.json');
    const keyFile = path.join(dir, 'secret.key');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    this.secret = process.env.ABYSS_SECRET || fs.readFileSync(keyFile, 'utf8').trim();
    this.db = { users: {}, byName: {} };
    if (fs.existsSync(this.file)) this.db = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    this.saveTimer = null;
  }
  // 原子寫入，避免當機時檔案損毀
  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this.saveTimer);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }

  // ---------- 權杖 ----------
  sign(uid) {
    const body = b64u(JSON.stringify({ uid, iat: Date.now() }));
    return body + '.' + crypto.createHmac('sha256', this.secret).update(body).digest('base64url');
  }
  verify(token) {
    if (typeof token !== 'string') return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const good = crypto.createHmac('sha256', this.secret).update(body).digest('base64url');
    if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
    try { const { uid } = JSON.parse(Buffer.from(body, 'base64url').toString()); return this.db.users[uid] || null; } catch { return null; }
  }

  // ---------- 驗證 ----------
  static nick(n) {
    n = String(n || '').trim().replace(/\s+/g, ' ');
    if (!n) fail('請輸入暱稱');
    if ([...n].length > 10) fail('暱稱最多 10 個字');
    return n;
  }
  static username(u) {
    u = String(u || '').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(u)) fail('帳號需為 3～16 個英文字母、數字或底線');
    return u;
  }
  static password(p) {
    p = String(p || '');
    if (p.length < 6 || p.length > 64) fail('密碼長度需為 6～64 個字元');
    return p;
  }
  hash(pw, salt = crypto.randomBytes(16).toString('hex')) {
    return { salt, hash: crypto.scryptSync(pw, salt, 32).toString('hex') };
  }

  // ---------- 帳號 ----------
  newUser(fields) {
    const id = crypto.randomBytes(8).toString('hex');
    const u = { id, username: null, pass: null, guest: true, nick: '獵人', crystals: 120, cls: 'blade', created: Date.now(),
      trees: Object.fromEntries(CLS.map(c => [c, {}])), owned: Object.fromEntries(CLS.map(c => [c, [defaultSkin(c)]])),
      sel: Object.fromEntries(CLS.map(c => [c, defaultSkin(c)])),
      stats: { runs: 0, wins: 0, kills: 0, bossKills: 0, best: { ch: 0, sg: 0 } }, ...fields };
    this.db.users[id] = u;
    return u;
  }
  register(username, password, nick) {
    username = Accounts.username(username); password = Accounts.password(password); nick = Accounts.nick(nick || username);
    if (this.db.byName[username.toLowerCase()]) fail('這個帳號名稱已經有人使用');
    const u = this.newUser({ username, pass: this.hash(password), guest: false, nick });
    this.db.byName[username.toLowerCase()] = u.id;
    this.save();
    return u;
  }
  login(username, password) {
    const id = this.db.byName[String(username || '').trim().toLowerCase()];
    const u = id && this.db.users[id];
    if (!u || !u.pass) fail('帳號或密碼錯誤');
    const { hash } = this.hash(String(password || ''), u.pass.salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.pass.hash, 'hex'))) fail('帳號或密碼錯誤');
    return u;
  }
  guest(nick) {
    const u = this.newUser({ nick: nick ? Accounts.nick(nick) : '遊客' + Math.floor(1000 + Math.random() * 9000) });
    this.save();
    return u;
  }
  // 遊客升級成正式帳號（保留所有進度）
  bind(u, username, password) {
    if (!u.guest) fail('這已經是正式帳號');
    username = Accounts.username(username); password = Accounts.password(password);
    if (this.db.byName[username.toLowerCase()]) fail('這個帳號名稱已經有人使用');
    Object.assign(u, { username, pass: this.hash(password), guest: false });
    this.db.byName[username.toLowerCase()] = u.id;
    this.save();
    return u;
  }
  profile(u) {
    const { id, username, guest, nick, crystals, cls, trees, owned, sel, stats } = u;
    return { id, username, guest, nick, crystals, cls, trees, owned, sel, stats };
  }
  meta(u) { return { trees: u.trees, sel: u.sel }; }
  setNick(u, nick) { u.nick = Accounts.nick(nick); this.save(); }
  setClass(u, cls) { if (CLASSES[cls]) { u.cls = cls; this.save(); } }
  buyTree(u, cls, nodeId) {
    const n = TREE_MAP[nodeId];
    if (!CLASSES[cls] || !n) fail('找不到這個天賦');
    const tree = u.trees[cls] ||= {}, lv = tree[n.id] || 0;
    if (lv >= n.max) fail('已達最高等級');
    if (n.req && (tree[n.req[0]] || 0) < n.req[1]) fail(`需要先將「${TREE_MAP[n.req[0]].name}」升到 Lv${n.req[1]}`);
    const cost = n.cost(lv + 1);
    if (u.crystals < cost) fail('魂晶不足');
    u.crystals -= cost; tree[n.id] = lv + 1;
    this.save();
  }
  skin(u, cls, skinId) {
    const sk = (SKINS[cls] || []).find(s => s.id === skinId);
    if (!sk) fail('找不到這個造型');
    const owned = u.owned[cls] ||= [defaultSkin(cls)];
    if (!owned.includes(sk.id)) {
      if (u.crystals < sk.cost) fail('魂晶不足');
      u.crystals -= sk.cost; owned.push(sk.id);
    }
    u.sel[cls] = sk.id;
    this.save();
  }
  // 一輪冒險結束：發放魂晶並更新統計
  reward(u, result, kills) {
    const crystals = crystalsFor({ ...result, kills });
    u.crystals += crystals;
    const st = u.stats;
    st.runs++; if (result.win) st.wins++;
    st.kills += kills; st.bossKills += result.bossKills;
    if (result.ch > st.best.ch || (result.ch === st.best.ch && result.sg > st.best.sg)) st.best = { ch: result.ch, sg: result.sg };
    this.save();
    return crystals;
  }
}
