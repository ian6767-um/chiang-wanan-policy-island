// 晶片音樂引擎＋原創曲目（脈衝波主旋律、三角波貝斯、琶音、噪音鼓）
// 記譜：每小節 16 格（16 分音符），旋律寫成「音名:長度」，r 代表休止符。

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
  if (!m) throw new Error('bad note ' + n);
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const freq = m => 440 * Math.pow(2, (m - 69) / 12);
function chordNotes(name) {
  const m = /^([A-G][#b]?)(m|dim|sus4)?$/.exec(name);
  const root = midi(m[1] + '3') % 12;
  const q = m[2] || '';
  const iv = q === 'm' ? [0, 3, 7] : q === 'dim' ? [0, 3, 6] : q === 'sus4' ? [0, 5, 7] : [0, 4, 7];
  return { root, iv };
}
export function parseBar(str) {
  const out = []; let t = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, d] = tok.split(':'); const len = +d;
    if (n !== 'r') out.push({ t, len, m: midi(n) });
    t += len;
  }
  return { notes: out, len: t };
}

// ---------- 曲目 ----------
export const SONGS = {
  // 標題：懷舊又帶點英雄感
  title: { bpm: 104, lead: 'p25', bass: 'pulse', arp: 'up', drums: 'light', echo: 0.28,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    mel: ['E5:4 G5:4 C6:6 B5:2', 'D6:4 B5:4 G5:8', 'A5:4 C6:4 E6:4 D6:2 C6:2', 'C6:6 A5:2 F5:8',
      'E5:2 F5:2 G5:4 E5:4 C5:4', 'D5:4 G5:4 B5:6 A5:2', 'A5:4 G5:2 F5:2 C5:4 D5:4', 'G5:12 r:4',
      'E5:4 G5:4 C6:6 B5:2', 'D6:4 B5:4 G5:8', 'A5:4 C6:4 E6:4 D6:2 C6:2', 'C6:6 A5:2 F5:8',
      'E5:2 F5:2 G5:4 E5:4 C5:4', 'D5:4 G5:4 B5:6 A5:2', 'A5:4 C6:4 A5:4 B5:4', 'C6:12 r:4'] },
  // 營地：溫暖的小屋
  camp: { bpm: 88, lead: 'p12', bass: 'walk', arp: 'updown', drums: 'none', echo: 0.32,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'],
    mel: ['A4:4 C5:4 F5:4 E5:4', 'D5:6 C5:2 A4:8', 'Bb4:4 D5:4 F5:4 D5:4', 'E5:8 G5:4 E5:4',
      'F5:4 A5:4 C6:2 A5:2 G5:4', 'D5:4 F5:4 A5:8', 'F5:4 G5:2 F5:2 D5:4 Bb4:4', 'C5:12 r:4'] },
  // 事件關卡：輕快的商店曲
  event: { bpm: 100, lead: 'p12', bass: 'walk', arp: 'updown', drums: 'light', echo: 0.25,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'],
    mel: ['B4:2 D5:2 G5:4 B5:2 A5:2 G5:4', 'G5:4 E5:4 B4:8', 'C5:2 E5:2 G5:4 G5:2 A5:2 G5:4', 'F#5:4 A5:4 D5:8',
      'G5:2 A5:2 B5:4 D6:2 B5:2 G5:4', 'E5:4 G5:4 B5:8', 'G5:4 A5:2 G5:2 E5:4 C5:4', 'D5:12 r:4'] },
  // 第一章：石之迴廊（A 小調，推進感）
  ch1: { bpm: 132, lead: 'p25', bass: 'drive', arp: 'up', drums: 'four', echo: 0.2,
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'],
    mel: ['A4:2 A4:2 C5:2 E5:4 D5:2 C5:2 B4:2', 'C5:4 A4:4 F4:4 A4:4', 'E5:2 E5:2 G5:2 C6:4 B5:2 G5:2 E5:2', 'D5:6 B4:2 G4:8',
      'A5:4 G5:2 E5:2 A5:4 B5:2 C6:2', 'A5:6 F5:2 C5:8', 'B4:2 D5:2 G5:4 D5:2 B4:2 G4:4', 'G#4:4 B4:4 E5:8'] },
  // 第二章：苔蘚洞窟（D 多利安，彈跳）
  ch2: { bpm: 120, lead: 'p12', bass: 'walk', arp: 'updown', drums: 'shuffle', echo: 0.25,
    chords: ['Dm', 'G', 'Dm', 'G', 'F', 'C', 'Dm', 'A'],
    mel: ['D5:3 F5:1 A5:4 F5:2 E5:2 D5:4', 'D5:4 B4:4 G4:4 B4:4', 'A5:3 G5:1 F5:4 D5:2 E5:2 C5:4', 'B4:8 G4:4 r:4',
      'F5:2 G5:2 A5:4 C6:4 A5:4', 'G5:4 E5:4 C5:8', 'D5:2 E5:2 F5:4 A5:2 G5:2 F5:4', 'A4:4 C#5:4 E5:8'] },
  // 第三章：熔岩深淵（E 和聲小調，激烈）
  ch3: { bpm: 150, lead: 'p25', bass: 'gallop', arp: 'up', drums: 'rock', echo: 0.18,
    chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B'],
    mel: ['E5:2 E5:2 r:2 E5:2 G5:2 F#5:2 E5:2 D#5:2', 'E5:4 B4:4 G4:4 E4:4', 'A4:2 C5:2 E5:2 A5:4 G5:2 F#5:2 E5:2', 'F#5:6 D#5:2 B4:8',
      'B5:4 A5:2 G5:2 E5:4 F#5:4', 'G5:4 E5:2 C5:2 E5:8', 'F#5:2 A5:2 D6:4 A5:2 F#5:2 D5:4', 'D#5:4 F#5:4 B5:8'] },
  // 第四章：冰封墓穴（B 小調，清冷鐘聲）
  ch4: { bpm: 108, lead: 'tri', bass: 'pulse', arp: 'bell', drums: 'light', echo: 0.4,
    chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'],
    mel: ['F#5:6 D5:2 B4:8', 'G5:4 F#5:4 D5:8', 'A5:6 F#5:2 D5:4 E5:4', 'C#5:12 r:4',
      'B5:4 A5:4 F#5:4 D5:4', 'D5:4 G5:4 B5:8', 'G5:4 F#5:4 E5:4 D5:4', 'C#5:8 A#4:8'] },
  // 第五章：虛空王座（升 C 小調，詭譎）
  ch5: { bpm: 138, lead: 'p12', bass: 'drive', arp: 'up', drums: 'four', echo: 0.3,
    chords: ['C#m', 'A', 'F#m', 'G#', 'C#m', 'A', 'F#m', 'G#'],
    mel: ['C#5:2 E5:2 G#5:2 C#6:2 G#5:4 E5:4', 'A5:4 E5:4 C#5:4 E5:4', 'F#5:2 A5:2 C#6:4 A5:2 F#5:2 G#5:4', 'G#5:4 C6:4 D#6:8',
      'E6:4 D#6:2 C#6:2 G#5:8', 'C#6:4 B5:2 A5:2 E5:8', 'A5:2 G#5:2 F#5:2 E5:2 F#5:4 A5:4', 'G#5:12 r:4'] },
  // 頭目戰（依章節移調）
  boss: { bpm: 168, lead: 'p25', bass: 'boss', arp: 'up', drums: 'boss', echo: 0.15,
    chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'],
    mel: ['A4:2 C5:2 E5:2 A5:2 E5:2 G5:2 C5:2 E5:2', 'D5:2 G5:2 B5:4 G5:2 A5:2 D5:4', 'C5:2 F5:2 A5:2 C6:4 A5:2 F5:4', 'G#5:6 B5:2 E6:4 D6:2 B5:2',
      'C6:4 B5:2 A5:2 E5:4 A5:4', 'B5:4 A5:2 G5:2 D5:4 G5:4', 'A5:2 G5:2 F5:2 E5:2 F5:2 A5:2 C6:4', 'B5:4 G#5:4 E5:4 r:4'] },
  // 最終章頭目
  final: { bpm: 176, lead: 'p25', bass: 'boss', arp: 'up', drums: 'boss', echo: 0.15,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
    mel: ['C5:2 G5:2 C6:2 G5:2 Eb6:4 D6:2 C6:2', 'C6:4 Ab5:4 Eb5:4 C5:4', 'D5:2 F5:2 Bb5:2 F5:2 D6:4 C6:2 Bb5:2', 'B5:8 D6:4 G6:4',
      'G6:4 F6:2 Eb6:2 C6:4 D6:4', 'Eb6:4 C6:4 Ab5:8', 'F5:2 Ab5:2 C6:2 F6:2 C6:2 Ab5:2 F5:4', 'B5:4 D6:4 G5:8'] },
};
// 一次性小曲
export const JINGLES = {
  victory: { bpm: 140, lead: 'p25', mel: 'C5:2 E5:2 G5:2 C6:6 G5:2 C6:16', chord: 'C' },
  clear: { bpm: 150, lead: 'p25', mel: 'G5:2 C6:2 E6:6 r:6', chord: 'C' },
  gameover: { bpm: 72, lead: 'tri', mel: 'E5:6 D5:2 C5:8 B4:6 G#4:2 A4:16', chord: 'Am' },
  boss: { bpm: 120, lead: 'p25', mel: 'A3:2 A3:2 A3:2 r:2 F3:4 G3:4 A3:16', chord: 'Am' },
};

// ---------- 合成 ----------
let AC = null, analyser = null, out = null, musicGain = null, echoIn = null, waves = {}, noise = null;
let lastFileSong = null;
let cur = null, timer = null, muted = false, volume = 0.55;
try { muted = localStorage.getItem('ah_music') === 'off'; } catch { /* 無法讀取 */ }

function pulseWave(duty) {
  const n = 64, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return AC.createPeriodicWave(re, im);
}
export function initMusic(ac, dest) {
  if (AC) return;
  AC = ac;
  out = AC.createGain(); out.gain.value = muted ? 0 : volume; out.connect(dest);
  analyser = AC.createAnalyser(); analyser.fftSize = 1024; out.connect(analyser);
  musicGain = AC.createGain(); musicGain.gain.value = 1; musicGain.connect(out);
  // 迴聲（給主旋律）
  echoIn = AC.createGain(); echoIn.gain.value = 1;
  const delay = AC.createDelay(1); delay.delayTime.value = 0.21;
  const fb = AC.createGain(); fb.gain.value = 0.32;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  echoIn.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(musicGain);
  waves = { p12: pulseWave(0.125), p25: pulseWave(0.25), p50: pulseWave(0.5) };
  noise = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function voice(type, f, t, dur, vol, opt = {}) {
  const o = AC.createOscillator(), g = AC.createGain();
  if (type === 'tri') o.type = 'triangle'; else if (type === 'sine') o.type = 'sine'; else o.setPeriodicWave(waves[type] || waves.p25);
  o.frequency.setValueAtTime(f, t);
  if (opt.vib && dur > 0.25) {
    const l = AC.createOscillator(), lg = AC.createGain();
    l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
    l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
  }
  const a = 0.006, rel = Math.min(0.08, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.linearRampToValueAtTime(vol * (opt.sus ?? 0.7), t + a + 0.06);
  g.gain.setValueAtTime(vol * (opt.sus ?? 0.7), t + Math.max(a + 0.06, dur - rel));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicGain);
  if (opt.echo) { const eg = AC.createGain(); eg.gain.value = opt.echo; g.connect(eg); eg.connect(echoIn); }
  o.start(t); o.stop(t + dur + 0.02);
}
function drum(kind, t, vol = 1) {
  if (kind === 'k') {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    g.gain.setValueAtTime(0.5 * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.18);
    return;
  }
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noise;
  const len = kind === 's' ? 0.14 : kind === 'o' ? 0.12 : 0.035;
  f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
  g.gain.setValueAtTime((kind === 's' ? 0.32 : 0.12) * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f); f.connect(g); g.connect(musicGain); s.start(t, Math.random() * 0.5); s.stop(t + len);
}

// 鼓組：k 大鼓、s 小鼓、h 閉合鈸、o 開放鈸（每小節 16 格）
const DRUMS = {
  none: {},
  light: { k: [0, 8], h: [2, 6, 10, 14] },
  four: { k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
  shuffle: { k: [0, 6, 8], s: [4, 12], h: [0, 3, 4, 7, 8, 11, 12, 15] },
  rock: { k: [0, 3, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], o: [14] },
  boss: { k: [0, 2, 6, 8, 10, 14], s: [4, 12, 15], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
};

// 把一首歌編譯成事件列表
function compile(song, tr = 0) {
  const ev = [];
  const bars = song.chords.length;
  for (let b = 0; b < bars; b++) {
    const base = b * 16;
    const { root, iv } = chordNotes(song.chords[b]);
    const br = 40 + (((root + tr - 4) % 12) + 12) % 12; // 貝斯固定在 E2~D#3
    const five = br + 7, oct = br + 12;
    const B = (t, m, len, v = 0.2) => ev.push({ t: base + t, len, m, ch: 'bass', v });
    switch (song.bass) {
      case 'pulse': B(0, br, 8); B(8, br, 8); break;
      case 'walk': B(0, br, 4); B(4, five, 4); B(8, oct, 4); B(12, five, 4); break;
      case 'drive': for (let i = 0; i < 16; i += 2) B(i, i % 4 === 0 ? br : oct, 2); break;
      case 'gallop': for (let i = 0; i < 16; i += 4) { B(i, br, 2); B(i + 2, br, 1); B(i + 3, oct, 1); } break;
      case 'boss': for (let i = 0; i < 16; i++) B(i, i % 4 === 2 ? oct : br, 1, 0.18); break;
    }
    // 琶音（和弦音，C4~C5 附近）
    const ar = 60 + ((root + tr) % 12 + 12) % 12;
    const tones = [ar + iv[0], ar + iv[1], ar + iv[2], ar + 12];
    const A = (t, m, len, v) => ev.push({ t: base + t, len, m, ch: 'arp', v });
    if (song.arp === 'up') for (let i = 0; i < 16; i++) A(i, tones[i % 4], 1, 0.035);
    if (song.arp === 'updown') { const seq = [0, 1, 2, 3, 2, 1]; for (let i = 0; i < 16; i += 2) A(i, tones[seq[(i / 2) % 6]], 2, 0.04); }
    if (song.arp === 'bell') for (let i = 0; i < 16; i += 4) A(i, tones[(i / 4) % 4] + 12, 4, 0.05);
    // 鼓
    const D = DRUMS[song.drums] || {};
    for (const kind of ['k', 's', 'h', 'o']) for (const t of D[kind] || []) ev.push({ t: base + t, ch: 'drum', kind });
    // 旋律
    const bar = parseBar(song.mel[b % song.mel.length]);
    for (const n of bar.notes) ev.push({ t: base + n.t, len: n.len, m: n.m + tr, ch: 'lead' });
  }
  ev.sort((a, b) => a.t - b.t);
  return { ev, steps: bars * 16 };
}

function schedule() {
  if (!cur) return;
  const stepDur = 60 / cur.song.bpm / 4, ahead = AC.currentTime + 0.18;
  while (true) {
    const e = cur.data.ev[cur.idx];
    const t = cur.start + (cur.loop * cur.data.steps + (e ? e.t : cur.data.steps)) * stepDur;
    if (!e) { if (cur.once) { cur = null; return; } cur.loop++; cur.idx = 0; continue; }
    if (t > ahead) break;
    if (t >= AC.currentTime - 0.02) play(e, t, stepDur);
    cur.idx++;
  }
}
function play(e, t, sd) {
  const s = cur.song;
  if (e.ch === 'drum') return drum(e.kind, t);
  const dur = e.len * sd * (e.ch === 'lead' ? 0.92 : 0.85);
  if (e.ch === 'lead') voice(s.lead, freq(e.m), t, dur, s.lead === 'tri' ? 0.2 : 0.085, { vib: true, echo: s.echo });
  else if (e.ch === 'bass') voice('tri', freq(e.m), t, dur, e.v);
  else voice(s.arpWave || 'p12', freq(e.m), t, dur, e.v, { sus: 0.5 });
}

// 若 public/music/ 內有對應音檔（例如用 Suno 生成），優先播放音檔
const FILE_OF = { title: 'title', camp: 'hub', event: 'dungeon', ch1: 'dungeon', ch2: 'dungeon', ch3: 'dungeon', ch4: 'dungeon', ch5: 'dungeon', boss: 'boss', final: 'boss' };
const files = {};
let fileAudio = null, fileKey = null;
export function probeMusicFiles() {
  // 先讀靜態清單 music/index.json（Netlify 版本由建置腳本產生），沒有再問伺服器
  const use = j => { for (const f of j.files || []) files[f.replace(/\.mp3$/, '')] = 'music/' + f; };
  fetch('music/index.json').then(r => (r.ok ? r.json() : Promise.reject())).then(use)
    .catch(() => fetch(String(window.ABYSS_SERVER || '').replace(/\/+$/, '') + '/api/music').then(r => r.json()).then(use)).catch(() => {});
}
function playFile(f) {
  if (fileKey === f) return true;
  if (fileAudio) fileAudio.pause();
  fileAudio = new Audio(files[f]); fileAudio.loop = true; fileAudio.volume = muted ? 0 : volume; fileAudio.play().catch(() => {});
  fileKey = f; return true;
}
export function playSong(name, tr = 0) {
  if (!AC) return;
  const key = name + ':' + tr;
  if (cur && cur.key === key) return;
  const f = FILE_OF[name];
  if (f && files[f]) { if (fileKey !== f) { stopMusic(0.2); playFile(f); } cur = cur && cur.key === key ? cur : null; lastFileSong = key; return; }
  if (fileAudio) { fileAudio.pause(); fileAudio = null; fileKey = null; }
  stopMusic(0.25);
  const song = SONGS[name];
  if (!song) return;
  setTimeout(() => {
    cur = { key, song, data: compile(song, tr), start: AC.currentTime + 0.05, loop: 0, idx: 0 };
    musicGain.gain.cancelScheduledValues(AC.currentTime);
    musicGain.gain.setValueAtTime(0.0001, AC.currentTime);
    musicGain.gain.linearRampToValueAtTime(1, AC.currentTime + 0.4);
    if (!timer) timer = setInterval(schedule, 25);
  }, 260);
}
export function playJingle(name) {
  if (!AC) return;
  if (fileAudio) { fileAudio.pause(); fileAudio = null; fileKey = null; }
  const j = JINGLES[name];
  stopMusic(0.1);
  setTimeout(() => {
    const song = { bpm: j.bpm, lead: j.lead, bass: 'pulse', arp: 'none', drums: 'none', echo: 0.3, chords: [j.chord], mel: [j.mel] };
    const bar = parseBar(j.mel);
    const data = compile({ ...song, chords: Array(Math.ceil(bar.len / 16)).fill(j.chord), mel: [j.mel] });
    data.ev = data.ev.filter(e => e.ch === 'lead' || (e.ch === 'bass' && e.t === 0));
    cur = { key: 'jingle:' + name, song, data, start: AC.currentTime + 0.05, loop: 0, idx: 0, once: true };
    musicGain.gain.cancelScheduledValues(AC.currentTime); musicGain.gain.setValueAtTime(1, AC.currentTime);
    if (!timer) timer = setInterval(schedule, 25);
  }, 120);
}
export function stopMusic(fade = 0.3) {
  if (!AC || !cur) { cur = null; return; }
  const t = AC.currentTime;
  musicGain.gain.cancelScheduledValues(t); musicGain.gain.setValueAtTime(musicGain.gain.value, t); musicGain.gain.linearRampToValueAtTime(0.0001, t + fade);
  cur = null;
}
export function musicTap(node) { if (out) out.connect(node); }
export function musicLevel() {
  if (!analyser) return 0;
  const d = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(d);
  return Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length);
}
export function currentSong() { return cur ? cur.key : null; }
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ah_music', muted ? 'off' : 'on'); } catch { /* 無法儲存 */ }
  if (out) out.gain.setTargetAtTime(muted ? 0 : volume, AC.currentTime, 0.05);
  if (fileAudio) fileAudio.volume = muted ? 0 : volume;
  return muted;
}
