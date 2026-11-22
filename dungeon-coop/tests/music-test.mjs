// 檢查每首曲子：每小節剛好 16 格、強拍（第 1、3 拍）的旋律音是和弦音、音域合理
import { SONGS, JINGLES, parseBar, midi } from '../public/music.js';
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pc = n => { const m = /^([A-G])([#b]?)/.exec(n); return (NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12; };
function chordPcs(c) { const m = /^([A-G][#b]?)(m|dim)?$/.exec(c); const r = pc(m[1]); const iv = m[2] === 'm' ? [0, 3, 7] : m[2] === 'dim' ? [0, 3, 6] : [0, 4, 7]; return iv.map(i => (r + i) % 12); }
let bad = 0;
for (const [name, s] of Object.entries(SONGS)) {
  if (s.mel.length !== s.chords.length) { console.log(name, '旋律與和弦小節數不同'); bad++; }
  s.mel.forEach((bar, i) => {
    const b = parseBar(bar);
    if (b.len !== 16) { console.log(`${name} 第 ${i + 1} 小節長度 ${b.len}`); bad++; }
    const cp = chordPcs(s.chords[i]);
    for (const n of b.notes) {
      if ((n.t === 0 || n.t === 8) && !cp.includes(n.m % 12)) { console.log(`${name} 第 ${i + 1} 小節 強拍音不在和弦 ${s.chords[i]} 內：midi ${n.m}`); bad++; }
      if (n.m < midi('E4') || n.m > midi('G6')) { console.log(`${name} 音域超出：${n.m}`); bad++; }
    }
  });
}
for (const [name, j] of Object.entries(JINGLES)) parseBar(j.mel);
console.log(bad ? `發現 ${bad} 個問題` : `全部 ${Object.keys(SONGS).length} 首曲子與 ${Object.keys(JINGLES).length} 段小曲檢查通過`);
process.exitCode = bad ? 1 : 0;
