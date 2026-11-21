// 音效與配樂：全部用 WebAudio 即時合成（之後可以換成 AI 配樂檔，見 docs/設計文件第 5 部分）。

const SCALES = {
  title: { notes: [0, 2, 4, 7, 9], root: 57, tempo: 70, wave: 'triangle' },
  inner: { notes: [0, 2, 4, 7, 9], root: 60, tempo: 76, wave: 'triangle' },
  north: { notes: [0, 2, 5, 7, 9], root: 62, tempo: 84, wave: 'sine' },
  west: { notes: [0, 3, 5, 7, 10], root: 57, tempo: 66, wave: 'sine' },
  south: { notes: [0, 2, 4, 7, 11], root: 55, tempo: 58, wave: 'sine' },
  night: { notes: [0, 2, 4, 7, 9], root: 52, tempo: 54, wave: 'sine' },
  shop: { notes: [0, 2, 4, 5, 7, 9], root: 64, tempo: 96, wave: 'square' },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.music = 0.5;
    this.sfxVol = 0.8;
    this.track = null;
    this.nextNote = 0;
    this.step = 0;
    this.enabled = false;
    this.noiseBuf = null;
    this.ambient = null;
  }

  /** 瀏覽器規定要在使用者操作後才能開始播放 */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.setVolumes(this.music, this.sfxVol);
    this.enabled = true;
    this.startAmbient();
  }

  setVolumes(music, sfx) {
    this.music = music; this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.value = music * 0.35;
    this.sfxGain.gain.value = sfx * 0.6;
    if (this.ambientGain) this.ambientGain.gain.value = music * 0.08;
  }

  suspend() { this.ctx?.suspend?.(); }
  resume() { this.ctx?.resume?.(); }

  setTrack(name) { this.track = SCALES[name] ? name : 'inner'; }

  /** 海浪環境音：濾波噪音＋緩慢起伏 */
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    this.ambientGain = this.ctx.createGain(); this.ambientGain.gain.value = this.music * 0.08;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain); lfoGain.connect(this.ambientGain.gain);
    src.connect(f); f.connect(this.ambientGain); this.ambientGain.connect(this.master);
    src.start(); lfo.start();
    this.ambient = src;
  }

  /** 每一幀呼叫：排程下一個音符（五聲音階的輕柔旋律） */
  tick() {
    if (!this.ctx || !this.track || this.music <= 0) return;
    const S = SCALES[this.track];
    const now = this.ctx.currentTime;
    if (this.nextNote < now) this.nextNote = now + 0.05;
    while (this.nextNote < now + 0.3) {
      const beat = 60 / S.tempo;
      const st = this.step++;
      const bar = Math.floor(st / 8) % 4;
      const chordRoot = [0, 5, 3, 4][bar];
      if (st % 8 === 0) this.note(S.root - 12 + S.notes[chordRoot % S.notes.length], this.nextNote, beat * 3.5, 'sine', 0.22);
      if (Math.random() < (st % 2 === 0 ? 0.55 : 0.25)) {
        const deg = (chordRoot + Math.floor(Math.random() * 5)) % S.notes.length;
        const oct = Math.random() < 0.3 ? 12 : 0;
        this.note(S.root + S.notes[deg] + oct, this.nextNote, beat * 0.9, S.wave, S.wave === 'square' ? 0.05 : 0.13);
      }
      this.nextNote += beat / 2;
    }
  }

  note(midi, t, dur, wave, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- 音效 ----------
  tone(freq, dur, { type = 'square', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { freq = 1200, vol = 0.3, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || this.sfxVol <= 0) return;
    switch (name) {
      case 'click': this.tone(880, 0.04, { vol: 0.12 }); break;
      case 'cast': this.noise(0.25, { freq: 2400, vol: 0.25 }); break;                    // 拋竿的咻聲
      case 'plop': this.tone(500, 0.12, { type: 'sine', slide: -350, vol: 0.4 }); break;   // 擬餌入水
      case 'bobber': this.tone(700, 0.05, { type: 'sine', vol: 0.2 }); break;
      case 'bite': this.tone(300, 0.08, { vol: 0.25 }); this.tone(450, 0.08, { vol: 0.25, delay: 0.09 }); break;
      case 'reel': for (let i = 0; i < 10; i++) this.noise(0.03, { freq: 3200, vol: 0.18, delay: i * 0.08 }); break; // 捲線器喀喀聲
      case 'splash': this.noise(0.4, { freq: 900, vol: 0.4, type: 'lowpass' }); break;
      case 'snap': this.tone(1400, 0.06, { vol: 0.3 }); this.tone(200, 0.2, { slide: -100, vol: 0.2, delay: 0.05 }); break;
      case 'common': this.tone(660, 0.1, { vol: 0.2 }); this.tone(880, 0.15, { vol: 0.2, delay: 0.1 }); break;
      case 'uncommon': [660, 880, 990].forEach((f, i) => this.tone(f, 0.14, { vol: 0.2, delay: i * 0.09 })); break;
      case 'rare': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, { type: 'triangle', vol: 0.3, delay: i * 0.1 })); break;
      case 'legendary': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.3, delay: i * 0.11 })); this.noise(1.2, { freq: 6000, vol: 0.1, delay: 0.3 }); break;
      case 'record': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, { vol: 0.22, delay: i * 0.07 })); break;
      case 'coin': this.tone(1318, 0.06, { vol: 0.2 }); this.tone(1760, 0.12, { vol: 0.2, delay: 0.06 }); break;
      case 'place': this.tone(440, 0.06, { type: 'triangle', vol: 0.3 }); break;
      case 'error': this.tone(160, 0.18, { vol: 0.25 }); break;
      case 'discard': this.noise(0.3, { freq: 700, vol: 0.3, type: 'lowpass' }); this.tone(400, 0.2, { type: 'sine', slide: -300, vol: 0.2 }); break;
      case 'meow': case 'meowExcited': this.tone(700, 0.25, { type: 'sawtooth', slide: 300, vol: 0.12 }); this.tone(1000, 0.2, { type: 'sawtooth', slide: -400, vol: 0.12, delay: 0.2 }); break;
      case 'meowCute': this.tone(900, 0.3, { type: 'triangle', slide: -300, vol: 0.18 }); break;
      case 'meowAnnoyed': this.tone(500, 0.25, { type: 'sawtooth', slide: -200, vol: 0.14 }); break;
      case 'purr': for (let i = 0; i < 8; i++) this.noise(0.06, { freq: 120, vol: 0.4, type: 'lowpass', delay: i * 0.09 }); break;
      case 'gull': this.tone(1500, 0.15, { type: 'sawtooth', slide: -600, vol: 0.05 }); this.tone(1400, 0.15, { type: 'sawtooth', slide: -500, vol: 0.05, delay: 0.2 }); break;
      case 'engine': for (let i = 0; i < 16; i++) this.noise(0.12, { freq: 160, vol: 0.25, type: 'lowpass', delay: i * 0.18 }); break;
      case 'door': this.tone(1568, 0.3, { type: 'sine', vol: 0.2 }); this.tone(2093, 0.4, { type: 'sine', vol: 0.15, delay: 0.12 }); break; // 開門鈴鐺
      case 'firework': this.noise(0.5, { freq: 300, vol: 0.15, type: 'lowpass' }); break;
      default: break;
    }
  }
}
