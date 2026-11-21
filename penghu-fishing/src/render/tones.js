// 各時段的配色（全部取自主調色盤）。清晨有霧、白天、黃金時段、紫粉色夕陽、夜晚。
import { PAL as C } from './pixel.js';

export const TONES = {
  dawn: {
    sky: [C.sky1, C.sky2, C.sky3, C.dk7], sun: { x: 0.18, y: 0.78, r: 9, c: C.ui4, glow: C.dk7 }, stars: false,
    cloud: [C.ba4, C.sky2, C.sky3, C.ui4], far: C.sky2,
    mid: { d: C.ba3, m: C.ba4, l: C.sky2 }, near: { d: C.ba2, m: C.ba3, l: C.ba4 },
    green: { d: C.pl1, m: C.pl2, l: C.pl3 }, sand: { d: C.sa1, m: C.sa2, l: C.sa3 },
    wall: { l: C.sky3, d: C.sky2, s: C.ba4 }, roof: C.cl2, stripe: C.ba1, window: C.ba3, lamp: C.dk7,
    band: [C.sea5, C.sea4], glint: C.ui4, under: [C.sea4, C.sea3, C.sea2, C.sea1, C.sea0],
    line: C.ui3, surface: C.sea6, fog: true,
  },
  day: {
    sky: [C.sky0, C.sky1, C.sky2, C.sky3], sun: { x: 0.12, y: 0.12, r: 8, c: C.ui4, glow: C.sky3 }, stars: false,
    cloud: [C.sky1, C.sky2, C.sky3, C.ui4], far: C.sky1,
    mid: { d: C.ba2, m: C.ba3, l: C.ba4 }, near: { d: C.ba1, m: C.ba2, l: C.ba3 },
    green: { d: C.pl1, m: C.pl2, l: C.pl3 }, sand: { d: C.sa1, m: C.sa2, l: C.sa3 },
    wall: { l: C.ui4, d: C.sky2, s: C.ba4 }, roof: C.wa1, stripe: C.ba0, window: C.ba2, lamp: C.wa3,
    band: [C.sea4, C.sea3], glint: C.ui4, under: [C.sea4, C.sea3, C.sea2, C.sea1, C.sea0],
    line: C.ui4, surface: C.sea6,
  },
  golden: {
    sky: [C.sky0, C.sky1, C.dk6, C.dk7], sun: { x: 0.72, y: 0.84, r: 10, c: C.ui4, glow: C.wa3 }, stars: false,
    cloud: [C.dk3, C.dk5, C.dk6, C.dk7], far: C.dk4,
    mid: { d: C.dk2, m: C.dk3, l: C.dk6 }, near: { d: C.dk1, m: C.dk2, l: C.dk6 },
    green: { d: C.dk1, m: C.dk2, l: C.pl4 }, sand: { d: C.wo3, m: C.wo4, l: C.dk6 },
    wall: { l: C.dk7, d: C.dk5, s: C.dk3 }, roof: C.wa0, stripe: C.dk1, window: C.dk2, lamp: C.wa3,
    band: [C.dk5, C.dk3], glint: C.wa3, under: [C.sea3, C.sea2, C.sea1, C.sea0, C.dk0],
    line: C.dk7, surface: C.dk7, rim: true,
  },
  sunset: {
    sky: [C.dk1, C.dk2, C.dk3, C.dk4, C.dk5, C.dk6], sun: { x: 0.7, y: 1.0, r: 12, c: C.dk7, glow: C.dk6 }, stars: false,
    cloud: [C.dk1, C.dk2, C.dk4, C.dk6], far: C.dk3,
    mid: { d: C.dk1, m: C.dk2, l: C.dk4 }, near: { d: C.dk0, m: C.dk1, l: C.dk5 },
    green: { d: C.dk0, m: C.dk1, l: C.dk3 }, sand: { d: C.dk2, m: C.dk3, l: C.dk5 },
    wall: { l: C.dk6, d: C.dk4, s: C.dk2 }, roof: C.dk2, stripe: C.dk0, window: C.wa2, lamp: C.wa3,
    band: [C.dk4, C.dk2], glint: C.dk7, under: [C.sea2, C.sea1, C.sea0, C.dk0],
    line: C.dk6, surface: C.dk6, rim: true,
  },
  night: {
    sky: [C.dk0, C.dk1, C.dk1, C.sea1], sun: { x: 0.85, y: 0.14, r: 6, c: C.ui4, glow: C.sky2, moon: true }, stars: true,
    cloud: [C.dk0, C.dk1, C.dk2, C.dk3], far: C.dk1,
    mid: { d: C.dk0, m: C.dk1, l: C.dk2 }, near: { d: C.ba0, m: C.dk0, l: C.ba1 },
    green: { d: C.ba0, m: C.pl0, l: C.pl1 }, sand: { d: C.ba1, m: C.ba2, l: C.ba3 },
    wall: { l: C.ba3, d: C.ba2, s: C.ba1 }, roof: C.dk1, stripe: C.ba0, window: C.wa3, lamp: C.wa3,
    band: [C.sea1, C.sea0], glint: C.sky2, under: [C.sea1, C.sea0, C.dk0],
    line: C.ba4, surface: C.sea3, night: true,
  },
};
