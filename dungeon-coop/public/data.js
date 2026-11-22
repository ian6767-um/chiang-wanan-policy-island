// 深淵獵團 — 遊戲資料：職業、增幅、共鳴、科技樹、皮膚、敵人、章節
export const CLASSES = {
  knight: { name: '騎士', hp: 130, shield: 60, speed: 72, regen: 6, skillName: '旋風斬', skillCost: 40, skillCd: 7, color: '#5b8cff',
    desc: '近戰揮砍，可彈開正面的敵方子彈。', skillDesc: '旋轉攻擊周圍敵人 2 秒，期間受到傷害減半。',
    uniqueName: '劍氣', uniqueDesc: '每第 3 次揮砍射出穿透劍氣' },
  ranger: { name: '遊俠', hp: 90, shield: 40, speed: 84, regen: 6, skillName: '箭雨', skillCost: 45, skillCd: 6, color: '#4fc35a',
    desc: '高速連射弓箭，機動性最高。', skillDesc: '扇形射出 13 支穿透箭。',
    uniqueName: '多重箭', uniqueDesc: '普攻額外射出 2 支斜向箭' },
  mage: { name: '法師', hp: 80, shield: 40, speed: 74, regen: 9, skillName: '冰霜新星', skillCost: 50, skillCd: 8, color: '#a46bff',
    desc: '爆裂火球造成範圍傷害（消耗能量）。', skillDesc: '凍結周圍敵人並造成大量傷害，可累積頭目硬直。',
    uniqueName: '炎爆', uniqueDesc: '火球必定點燃敵人，爆炸範圍 +30%' },
  cleric: { name: '牧師', hp: 100, shield: 50, speed: 76, regen: 6, skillName: '聖光庇護', skillCost: 50, skillCd: 10, color: '#ffd34d',
    desc: '穿透聖光彈，命中時治療受傷最重的隊友。', skillDesc: '範圍治療、補滿護盾，並立刻救起倒地隊友。',
    uniqueName: '神聖連結', uniqueDesc: '聖光彈命中時連鎖到附近敵人' },
};

export const defaultStats = () => ({
  dmg: 1, rate: 1, crit: 0.08, critDmg: 1.8, speed: 1, hpAdd: 0, shieldAdd: 0, dr: 0, skillCd: 1, regen: 0, lifesteal: 0, healMul: 1, energyRegen: 1,
  burnChance: 0, burnDmg: 1, burnExplode: false, dmgVsBurn: 0, dodgeFire: false, skillMeteor: 0,
  slowChance: 0, slowDur: 2, vsSlow: 0, freezeChance: 0, frostArmor: false, iceShards: 0, shatter: false, frozenVuln: 1,
  chainChance: 0, chainCount: 3, chainDmg: 1, staticField: 0, dodgeShock: false, paralyze: false, thunderSkill: false,
  poisonChance: 0, poisonMax: 8, poisonDmg: 1, poisonSpread: false, corrode: 0, dodgePoison: false, poisonBurst: false,
  thorns: 0, shieldRegen: 1, shieldDelay: 3, fullShieldDmg: 0, lastStand: false, shieldNova: false,
  dodgeCd: 1, dodgeCrit: false, windBlades: false, multishot: 0,
  guardian: false, aura: 0, holyShot: 0, killHeal: 0, fastRevive: false, skillHealTeam: false,
  execute: 0, bossDmg: 0, frenzy: false, curse: 0, shadowKnife: false, overheal: false, orbit: 0,
  goldMul: 1, rerolls: 0, startBoons: 0, lives: 0, wlStart: 1, unique: false,
});

export const TAGS = {
  fire: { name: '烈焰', color: '#ff7a3a', icon: '火' },
  frost: { name: '冰霜', color: '#7fd8ff', icon: '冰' },
  thunder: { name: '雷霆', color: '#ffe14a', icon: '雷' },
  poison: { name: '劇毒', color: '#8ee04a', icon: '毒' },
  steel: { name: '鋼鐵', color: '#c0cadf', icon: '鋼' },
  wind: { name: '疾風', color: '#6dffc4', icon: '風' },
  holy: { name: '聖光', color: '#fff0a0', icon: '聖' },
  shadow: { name: '暗影', color: '#c08cff', icon: '影' },
};

const pc = v => Math.round(v * 100) + '%';
export const BOONS = [
  // 烈焰
  { id: 'f_blade', tag: 'fire', name: '燃燒之刃', max: 3, desc: l => `攻擊有 ${pc(0.12 + 0.08 * l)} 機率點燃敵人`, apply: (s, l) => { s.burnChance += 0.12 + 0.08 * l; } },
  { id: 'f_power', tag: 'fire', name: '烈焰強化', max: 3, desc: l => `燃燒傷害 +${pc(0.4 * l)}`, apply: (s, l) => { s.burnDmg *= 1 + 0.4 * l; } },
  { id: 'f_trail', tag: 'fire', name: '火焰足跡', max: 1, desc: () => '翻滾時沿途留下燃燒的火焰', apply: s => { s.dodgeFire = true; } },
  { id: 'f_heart', tag: 'fire', name: '熾熱之心', max: 3, desc: l => `對燃燒中的敵人傷害 +${pc(0.15 * l)}`, apply: (s, l) => { s.dmgVsBurn += 0.15 * l; } },
  { id: 'f_meteor', tag: 'fire', name: '隕火', max: 2, desc: l => `施放技能時，向敵人降下 ${1 + 2 * l} 顆火焰隕石`, apply: (s, l) => { s.skillMeteor += 1 + 2 * l; } },
  // 冰霜
  { id: 'i_touch', tag: 'frost', name: '寒霜之觸', max: 3, desc: l => `攻擊有 ${pc(0.15 + 0.1 * l)} 機率使敵人緩速`, apply: (s, l) => { s.slowChance += 0.15 + 0.1 * l; } },
  { id: 'i_shatter', tag: 'frost', name: '碎冰', max: 3, desc: l => `對緩速或冰凍的敵人傷害 +${pc(0.15 * l)}`, apply: (s, l) => { s.vsSlow += 0.15 * l; } },
  { id: 'i_armor', tag: 'frost', name: '冰甲', max: 1, desc: () => '受到攻擊時凍結周圍敵人（4 秒冷卻）', apply: s => { s.frostArmor = true; } },
  { id: 'i_shards', tag: 'frost', name: '冰錐', max: 2, desc: l => `每 ${l === 1 ? 6 : 4} 次攻擊向四周射出 8 支緩速冰錐`, apply: (s, l) => { s.iceShards = l === 1 ? 6 : 4; } },
  { id: 'i_deep', tag: 'frost', name: '永凍', max: 2, desc: l => `緩速時間 +${l} 秒，緩速時有 ${pc(0.05 * l)} 機率直接冰凍`, apply: (s, l) => { s.slowDur += l; s.freezeChance += 0.05 * l; } },
  // 雷霆
  { id: 't_chain', tag: 'thunder', name: '連鎖閃電', max: 3, desc: l => `攻擊有 ${pc(0.1 + 0.08 * l)} 機率觸發彈跳閃電`, apply: (s, l) => { s.chainChance += 0.1 + 0.08 * l; } },
  { id: 't_field', tag: 'thunder', name: '靜電場', max: 3, desc: l => `每 2 秒電擊周圍 ${l} 個敵人`, apply: (s, l) => { s.staticField += l; } },
  { id: 't_over', tag: 'thunder', name: '超載', max: 2, desc: l => `閃電傷害 +${pc(0.5 * l)}`, apply: (s, l) => { s.chainDmg *= 1 + 0.5 * l; } },
  { id: 't_dodge', tag: 'thunder', name: '雷霆翻滾', max: 1, desc: () => '翻滾結束時釋放電擊環', apply: s => { s.dodgeShock = true; } },
  { id: 't_cond', tag: 'thunder', name: '導電', max: 2, desc: l => `閃電彈跳次數 +${2 * l}`, apply: (s, l) => { s.chainCount += 2 * l; } },
  // 劇毒
  { id: 'p_blade', tag: 'poison', name: '毒刃', max: 3, desc: l => `攻擊有 ${pc(0.3 + 0.15 * l)} 機率施加 1 層中毒`, apply: (s, l) => { s.poisonChance += 0.3 + 0.15 * l; } },
  { id: 'p_spread', tag: 'poison', name: '瘟疫擴散', max: 1, desc: () => '中毒的敵人死亡時，毒素傳染給附近敵人', apply: s => { s.poisonSpread = true; } },
  { id: 'p_corrode', tag: 'poison', name: '腐蝕', max: 3, desc: l => `中毒的敵人受到傷害 +${pc(0.12 * l)}`, apply: (s, l) => { s.corrode += 0.12 * l; } },
  { id: 'p_cloud', tag: 'poison', name: '毒霧翻滾', max: 1, desc: () => '翻滾時留下劇毒霧氣', apply: s => { s.dodgePoison = true; } },
  { id: 'p_conc', tag: 'poison', name: '濃縮毒素', max: 3, desc: l => `每層中毒傷害 +${pc(0.4 * l)}`, apply: (s, l) => { s.poisonDmg *= 1 + 0.4 * l; } },
  // 鋼鐵
  { id: 's_plate', tag: 'steel', name: '厚甲', max: 3, desc: l => `最大護盾 +${25 * l}`, apply: (s, l) => { s.shieldAdd += 25 * l; } },
  { id: 's_thorns', tag: 'steel', name: '荊棘', max: 3, desc: l => `受傷時對周圍敵人造成 ${30 * l} 點傷害`, apply: (s, l) => { s.thorns += 30 * l; } },
  { id: 's_tough', tag: 'steel', name: '堅毅', max: 3, desc: l => `受到的傷害 -${pc(0.07 * l)}`, apply: (s, l) => { s.dr += 0.07 * l; } },
  { id: 's_recharge', tag: 'steel', name: '護盾充能', max: 2, desc: l => `護盾回復速度 +${pc(0.75 * l)}，回復延遲 -${(0.8 * l).toFixed(1)} 秒`, apply: (s, l) => { s.shieldRegen *= 1 + 0.75 * l; s.shieldDelay -= 0.8 * l; } },
  { id: 's_vital', tag: 'steel', name: '生命強化', max: 3, desc: l => `最大生命 +${30 * l}`, apply: (s, l) => { s.hpAdd += 30 * l; } },
  // 疾風
  { id: 'w_light', tag: 'wind', name: '輕盈', max: 3, desc: l => `移動速度 +${pc(0.08 * l)}`, apply: (s, l) => { s.speed *= 1 + 0.08 * l; } },
  { id: 'w_rapid', tag: 'wind', name: '疾射', max: 3, desc: l => `攻擊速度 +${pc(0.12 * l)}`, apply: (s, l) => { s.rate *= 1 + 0.12 * l; } },
  { id: 'w_eye', tag: 'wind', name: '鷹眼', max: 3, desc: l => `暴擊率 +${pc(0.08 * l)}`, apply: (s, l) => { s.crit += 0.08 * l; } },
  { id: 'w_lethal', tag: 'wind', name: '致命一擊', max: 3, desc: l => `暴擊傷害 +${pc(0.4 * l)}`, apply: (s, l) => { s.critDmg += 0.4 * l; } },
  { id: 'w_step', tag: 'wind', name: '殘影', max: 2, desc: l => `翻滾冷卻 -${pc(0.25 * l)}`, apply: (s, l) => { s.dodgeCd *= 1 - 0.25 * l; } },
  { id: 'w_split', tag: 'wind', name: '分裂射擊', max: 2, desc: l => `攻擊額外射出 ${l} 發子彈（騎士為劍氣）`, apply: (s, l) => { s.multishot += l; } },
  // 聖光
  { id: 'h_regen', tag: 'holy', name: '再生', max: 3, desc: l => `每秒回復 ${(0.8 * l).toFixed(1)} 生命`, apply: (s, l) => { s.regen += 0.8 * l; } },
  { id: 'h_mend', tag: 'holy', name: '聖療', max: 2, desc: l => `受到的治療 +${pc(0.5 * l)}`, apply: (s, l) => { s.healMul *= 1 + 0.5 * l; } },
  { id: 'h_angel', tag: 'holy', name: '守護天使', max: 1, desc: () => '每個關卡一次，倒地時立即以 50% 生命復活', apply: s => { s.guardian = true; } },
  { id: 'h_aura', tag: 'holy', name: '勇氣光環', max: 3, desc: l => `附近隊友（含自己）傷害 +${pc(0.06 * l)}`, apply: (s, l) => { s.aura += 0.06 * l; } },
  { id: 'h_orb', tag: 'holy', name: '神聖彈', max: 2, desc: l => `每 ${l === 1 ? 5 : 3} 次攻擊射出追蹤聖光彈並治療隊友`, apply: (s, l) => { s.holyShot = l === 1 ? 5 : 3; } },
  // 暗影
  { id: 'd_leech', tag: 'shadow', name: '吸血', max: 3, desc: l => `造成傷害的 ${(2.5 * l).toFixed(1)}% 轉為生命`, apply: (s, l) => { s.lifesteal += 0.025 * l; } },
  { id: 'd_exec', tag: 'shadow', name: '處決', max: 2, desc: l => `直接擊殺生命低於 ${pc(0.1 * l)} 的一般敵人，對頭目傷害 +${pc(0.15 * l)}`, apply: (s, l) => { s.execute += 0.1 * l; s.bossDmg += 0.15 * l; } },
  { id: 'd_blade', tag: 'shadow', name: '暗影之刃', max: 3, desc: l => `傷害 +${pc(0.12 * l)}`, apply: (s, l) => { s.dmg *= 1 + 0.12 * l; } },
  { id: 'd_frenzy', tag: 'shadow', name: '收割', max: 1, desc: () => '擊殺後 2.5 秒內攻擊速度 +35%', apply: s => { s.frenzy = true; } },
  { id: 'd_curse', tag: 'shadow', name: '詛咒', max: 2, desc: l => `攻擊使敵人 3 秒內受到的傷害 +${pc(0.1 * l)}`, apply: (s, l) => { s.curse = Math.max(s.curse, 0.1 * l); } },
  { id: 'd_orbit', tag: 'shadow', name: '環繞飛刃', max: 3, desc: l => `${2 * l} 把暗影飛刃環繞自身，切割接近的敵人`, apply: (s, l) => { s.orbit += 2 * l; } },
];
export const BOON_MAP = Object.fromEntries(BOONS.map(b => [b.id, b]));
// 特殊選項（增幅池耗盡時）
export const SPECIAL = {
  gold: { name: '金幣袋', tag: null, desc: () => '獲得 40 金幣' },
  heal: { name: '生命之泉', tag: null, desc: () => '回復全部生命與護盾' },
};

export const RES = {
  fire: [{ n: 2, desc: '燃燒傷害 +50%', apply: s => { s.burnDmg *= 1.5; } }, { n: 4, desc: '燃燒中的敵人死亡時爆炸', apply: s => { s.burnExplode = true; } }, { n: 6, desc: '所有攻擊必定點燃，燃燒傷害再 ×2', apply: s => { s.burnChance = 1; s.burnDmg *= 2; } }],
  frost: [{ n: 2, desc: '緩速機率 +15%', apply: s => { s.slowChance += 0.15; } }, { n: 4, desc: '緩速時 12% 機率直接冰凍', apply: s => { s.freezeChance += 0.12; } }, { n: 6, desc: '冰凍敵人受傷 ×1.6，死亡時碎裂造成範圍傷害', apply: s => { s.shatter = true; s.frozenVuln = 1.6; } }],
  thunder: [{ n: 2, desc: '閃電機率 +10%', apply: s => { s.chainChance += 0.1; } }, { n: 4, desc: '閃電使敵人麻痺 0.6 秒', apply: s => { s.paralyze = true; } }, { n: 6, desc: '施放技能時召喚雷暴，打擊全場敵人', apply: s => { s.thunderSkill = true; } }],
  poison: [{ n: 2, desc: '中毒層數上限 +6', apply: s => { s.poisonMax += 6; } }, { n: 4, desc: '中毒傷害 ×1.6', apply: s => { s.poisonDmg *= 1.6; } }, { n: 6, desc: '中毒滿 10 層時引爆，造成大量範圍傷害', apply: s => { s.poisonBurst = true; } }],
  steel: [{ n: 2, desc: '受到的傷害 -6%', apply: s => { s.dr += 0.06; } }, { n: 4, desc: '護盾全滿時傷害 +25%', apply: s => { s.fullShieldDmg = 0.25; } }, { n: 6, desc: '護盾破碎時釋放衝擊波；每 20 秒可抵擋一次致命傷', apply: s => { s.lastStand = true; s.shieldNova = true; } }],
  wind: [{ n: 2, desc: '攻擊速度 +10%', apply: s => { s.rate *= 1.1; } }, { n: 4, desc: '翻滾後 1.5 秒內攻擊必定暴擊', apply: s => { s.dodgeCrit = true; } }, { n: 6, desc: '暴擊時額外射出追蹤風刃', apply: s => { s.windBlades = true; } }],
  holy: [{ n: 2, desc: '擊殺敵人回復 2 生命', apply: s => { s.killHeal += 2; } }, { n: 4, desc: '救援速度 ×2，被救起者護盾全滿', apply: s => { s.fastRevive = true; } }, { n: 6, desc: '施放技能時治療全隊 25% 生命', apply: s => { s.skillHealTeam = true; } }],
  shadow: [{ n: 2, desc: '傷害 +8%', apply: s => { s.dmg *= 1.08; } }, { n: 4, desc: '擊殺時向周圍射出 4 把暗影飛刀', apply: s => { s.shadowKnife = true; } }, { n: 6, desc: '吸血效果 ×3，溢出的治療轉為護盾', apply: s => { s.lifesteal *= 3; s.overheal = true; s.lifesteal = Math.max(s.lifesteal, 0.03); } }],
};

// 角色科技樹（每個職業獨立）
export const TREE = [
  { id: 'hp', name: '強健體魄', max: 5, col: 2, row: 0, req: null, cost: l => 30 + 20 * l, desc: l => `最大生命 +${15 * l}`, apply: (s, l) => { s.hpAdd += 15 * l; } },
  { id: 'atk', name: '武器精通', max: 5, col: 0, row: 1, req: ['hp', 1], cost: l => 40 + 25 * l, desc: l => `傷害 +${6 * l}%`, apply: (s, l) => { s.dmg *= 1 + 0.06 * l; } },
  { id: 'shield', name: '護盾強化', max: 3, col: 2, row: 1, req: ['hp', 1], cost: l => 40 + 30 * l, desc: l => `最大護盾 +${10 * l}`, apply: (s, l) => { s.shieldAdd += 10 * l; } },
  { id: 'energy', name: '能量湧泉', max: 3, col: 4, row: 1, req: ['hp', 1], cost: l => 40 + 30 * l, desc: l => `能量回復 +${15 * l}%`, apply: (s, l) => { s.energyRegen *= 1 + 0.15 * l; } },
  { id: 'crit', name: '精準', max: 3, col: 0, row: 2, req: ['atk', 2], cost: l => 80 + 40 * l, desc: l => `暴擊率 +${3 * l}%`, apply: (s, l) => { s.crit += 0.03 * l; } },
  { id: 'speed', name: '敏捷', max: 3, col: 2, row: 2, req: ['shield', 1], cost: l => 80 + 40 * l, desc: l => `移動速度 +${4 * l}%`, apply: (s, l) => { s.speed *= 1 + 0.04 * l; } },
  { id: 'cd', name: '冥想', max: 3, col: 4, row: 2, req: ['energy', 2], cost: l => 80 + 40 * l, desc: l => `技能冷卻 -${6 * l}%`, apply: (s, l) => { s.skillCd *= 1 - 0.06 * l; } },
  { id: 'boon', name: '天賦起手', max: 2, col: 0, row: 3, req: ['crit', 1], cost: l => 200 + 150 * l, desc: l => `開局獲得 ${l} 次增幅選擇`, apply: (s, l) => { s.startBoons += l; } },
  { id: 'forge', name: '起始鍛造', max: 2, col: 1, row: 3, req: ['atk', 3], cost: l => 220 + 150 * l, desc: l => `武器初始等級 +${l}`, apply: (s, l) => { s.wlStart += l; } },
  { id: 'revive', name: '不屈意志', max: 1, col: 2, row: 3, req: ['speed', 2], cost: () => 400, desc: () => '每局一次：倒地時立即以 50% 生命復活', apply: s => { s.lives += 1; } },
  { id: 'gold', name: '尋寶者', max: 3, col: 3, row: 3, req: ['cd', 1], cost: l => 100 + 60 * l, desc: l => `拾取金幣 +${15 * l}%`, apply: (s, l) => { s.goldMul += 0.15 * l; } },
  { id: 'reroll', name: '命運重擲', max: 2, col: 4, row: 3, req: ['cd', 2], cost: l => 180 + 120 * l, desc: l => `每局可重擲增幅選項 ${l} 次`, apply: (s, l) => { s.rerolls += l; } },
  { id: 'unique', name: '職業絕技', max: 1, col: 2, row: 4, req: ['revive', 1], cost: () => 650, desc: () => '解鎖職業專屬能力', apply: s => { s.unique = true; } },
];
export const TREE_MAP = Object.fromEntries(TREE.map(n => [n.id, n]));

// 皮膚：覆寫角色調色盤
export const SKINS = {
  knight: [
    { id: 'default', name: '皇家騎士', cost: 0, pal: {} },
    { id: 'obsidian', name: '黑曜騎士', cost: 300, pal: { m: '#5a5a6e', M: '#33333f', L: '#8a8aa0', a: '#9a1c2c', A: '#5e0f1a', y: '#ff5a3a' } },
    { id: 'paladin', name: '黃金聖騎', cost: 500, pal: { m: '#ffe08a', M: '#c99a2a', L: '#fff6c8', a: '#f4f0e6', A: '#c8c0b0', y: '#5ab0ff' } },
    { id: 'jade', name: '翡翠守衛', cost: 800, pal: { m: '#7fe0b0', M: '#3a9a70', L: '#c8ffe4', a: '#1f6a4a', A: '#0f3a28', y: '#ffd34d' } },
  ],
  ranger: [
    { id: 'default', name: '森林遊俠', cost: 0, pal: {} },
    { id: 'snow', name: '雪原獵手', cost: 300, pal: { a: '#e8f2ff', A: '#a8bcd8', L: '#ffffff', c: '#4a7bd1', C: '#2b3f7a', b: '#6a8ab0', B: '#3a5070' } },
    { id: 'fox', name: '赤狐', cost: 500, pal: { a: '#e0602a', A: '#9a3a14', L: '#ffa060', c: '#3a2418', C: '#1f130c', b: '#f4e8d0', B: '#b0a080' } },
    { id: 'owl', name: '夜梟', cost: 800, pal: { a: '#4a3a6e', A: '#2a1f46', L: '#7a68a8', c: '#1a1428', C: '#0c0814', b: '#c9a7ff', B: '#7a5ab0' } },
  ],
  mage: [
    { id: 'default', name: '紫袍法師', cost: 0, pal: {} },
    { id: 'flame', name: '烈焰術士', cost: 300, pal: { a: '#c8301a', A: '#7a1a0e', L: '#ff7a4a', y: '#ffe14a' } },
    { id: 'ice', name: '冰霜賢者', cost: 500, pal: { a: '#3ab0d8', A: '#1a6a8a', L: '#a8ecff', y: '#ffffff', w: '#dff6ff' } },
    { id: 'star', name: '星空占星師', cost: 800, pal: { a: '#1a2058', A: '#0c1030', L: '#3a4aa8', y: '#ffd34d', w: '#c8c8e8' } },
  ],
  cleric: [
    { id: 'default', name: '聖殿牧師', cost: 0, pal: {} },
    { id: 'moon', name: '月光祭司', cost: 300, pal: { a: '#c8d4ff', A: '#8a98c8', L: '#ffffff', y: '#7fd8ff', h: '#e8e8f8', H: '#a8a8c8' } },
    { id: 'sakura', name: '櫻花巫女', cost: 500, pal: { a: '#ffb0d0', A: '#d0709a', L: '#ffe0ee', y: '#ff4a7a', h: '#3a2030', H: '#1f1018' } },
    { id: 'dark', name: '暗聖修女', cost: 800, pal: { a: '#2a1f3a', A: '#140e1f', L: '#4a3a66', y: '#c08cff', h: '#e8e0f0', H: '#a898c0' } },
  ],
};

// 敵人
const P = {
  green: { a: '#5ccf5c', A: '#2f8f3f', L: '#b0f0a0' }, toxic: { a: '#9be04a', A: '#5a8a1a', L: '#e0ff9a', b: '#b05ae0' },
  lava: { a: '#ff6a2a', A: '#a8301a', L: '#ffc070', g: '#ffe14a' }, ice: { a: '#8fd8ff', A: '#3a8ab8', L: '#e8f8ff', g: '#ffffff' },
  void: { a: '#6a3ab0', A: '#2e1458', L: '#b07cff', g: '#ff4af0', b: '#1a0a30' }, bone: { w: '#e9e6dc', a: '#e9e6dc', A: '#a8a290', g: '#ff4a3a' },
};
export const ENEMIES = {
  // 第一章
  slime: { n: '綠史萊姆', spr: 'slime', pal: P.green, ai: 'hop', hp: 30, r: 6, sp: 34, dmg: 10 },
  bat: { n: '洞穴蝙蝠', spr: 'bat', pal: { a: '#7a4fa0', A: '#4a2a68', L: '#a87cd0', e: '#ff4040' }, ai: 'fly', hp: 16, r: 5, sp: 72, dmg: 8 },
  skelArcher: { n: '骷髏弓手', spr: 'skel', pal: { g: '#ff4a3a' }, ai: 'kite', hp: 28, r: 6, sp: 42, dmg: 10, shot: { k: 'bone', n: 1, v: 125, cd: 2 } },
  skelWarrior: { n: '骷髏戰士', spr: 'skel', pal: { w: '#cfc6b0', g: '#ffd34d' }, ai: 'chase', hp: 45, r: 6, sp: 44, dmg: 12 },
  orc: { n: '獸人蠻兵', spr: 'brute', pal: { a: '#6aa84f', A: '#3f6b2e', L: '#9ad07a', b: '#7a5230', B: '#4a3020' }, ai: 'charge', hp: 95, r: 8, sp: 30, dmg: 18 },
  bomber: { n: '爆彈鬼', spr: 'bomb', pal: { a: '#3a3a4a', A: '#1f1f2a', L: '#6a6a80' }, ai: 'exploder', hp: 20, r: 5, sp: 58, dmg: 26 },
  shroom: { n: '蘑菇術士', spr: 'shroom', pal: { a: '#d8443c', A: '#8a1f1a', L: '#ff8a7a', b: '#e8d6b0', B: '#b0a080' }, ai: 'caster', hp: 42, r: 6, sp: 22, dmg: 8, shot: { k: 'spore', n: 8, ring: 1, v: 70, cd: 2.7 } },
  rockling: { n: '石像哨塔', spr: 'crystal', pal: { a: '#9a9cab', A: '#5a5c68', L: '#d0d2e0', g: '#5ff2ff', m: '#6a6070', M: '#3a3440' }, ai: 'turret', hp: 60, r: 7, sp: 0, dmg: 10, shot: { k: 'rock', n: 3, spr: 0.25, v: 120, cd: 2.2 } },
  // 第二章
  poisonSlime: { n: '劇毒史萊姆', spr: 'slime', pal: P.toxic, ai: 'hop', hp: 42, r: 7, sp: 36, dmg: 11, fx: 'poison', split: { t: 'slimeMini', n: 2 } },
  slimeMini: { n: '小史萊姆', spr: 'slime', pal: P.toxic, ai: 'hop', hp: 12, r: 4, sp: 44, dmg: 6, scale: 0.65 },
  sporeBat: { n: '孢子蝙蝠', spr: 'bat', pal: { a: '#6a9a3a', A: '#3a5a1a', L: '#a8d870', e: '#e0ff6a' }, ai: 'fly', hp: 22, r: 5, sp: 74, dmg: 9, fx: 'poison' },
  spider: { n: '洞穴蜘蛛', spr: 'spider', pal: { a: '#4a3a2a', A: '#2a1f14', L: '#7a6048', e: '#ff4040' }, ai: 'leap', hp: 36, r: 6, sp: 55, dmg: 12, shot: { k: 'web', n: 1, v: 110, cd: 3, fx: 'slow' } },
  spiderling: { n: '小蜘蛛', spr: 'spider', pal: { a: '#6a8a2a', A: '#3a5014', L: '#a0c050', e: '#ffe14a' }, ai: 'chase', hp: 10, r: 4, sp: 82, dmg: 6, scale: 0.6 },
  flower: { n: '食人花', spr: 'plant', pal: { a: '#e04a8a', A: '#8a1f50', L: '#ff9ac8', b: '#ffd34d', g: '#4aa84a', G: '#2a6a2a' }, ai: 'turret', hp: 50, r: 7, sp: 0, dmg: 9, shot: { k: 'seed', n: 5, spr: 0.3, v: 115, cd: 2.3 } },
  beetle: { n: '硬殼甲蟲', spr: 'beetle', pal: { a: '#3a7a5a', A: '#1f4a34', L: '#6ac09a' }, ai: 'chase', hp: 110, r: 8, sp: 28, dmg: 14, armor: 0.3 },
  ghost: { n: '林地幽魂', spr: 'ghost', pal: { a: '#b8f0d0', A: '#6ab094', L: '#ffffff' }, ai: 'fly', phase: 1, hp: 30, r: 6, sp: 46, dmg: 10, alpha: 0.75 },
  goblin: { n: '哥布林投彈手', spr: 'imp', pal: { a: '#6ab04a', A: '#3a6a24', L: '#a0e07a', y: '#ffe14a' }, ai: 'mortar', hp: 32, r: 6, sp: 40, dmg: 16, cd: 2.8 },
  mossBrute: { n: '苔蘚巨人', spr: 'brute', pal: { a: '#4a7a3a', A: '#2a4a20', L: '#7ab060', b: '#3a5a2a', B: '#1f3414', r: '#ffe14a' }, ai: 'charge', hp: 140, r: 9, sp: 28, dmg: 20, scale: 1.15 },
  // 第三章
  lavaSlime: { n: '熔岩史萊姆', spr: 'slime', pal: P.lava, ai: 'hop', hp: 55, r: 7, sp: 36, dmg: 13, fx: 'burn' },
  fireWisp: { n: '火焰精靈', spr: 'wisp', pal: P.lava, ai: 'orbit', hp: 38, r: 6, sp: 70, dmg: 10, shot: { k: 'efire', n: 1, v: 140, cd: 1.3, fx: 'burn' } },
  imp: { n: '小惡魔', spr: 'imp', pal: { a: '#d8302a', A: '#7a1414', L: '#ff7a5a', y: '#ffe14a' }, ai: 'blink', hp: 40, r: 6, sp: 40, dmg: 12, shot: { k: 'efire', n: 3, spr: 0.2, v: 150, cd: 3 } },
  lavaWorm: { n: '熔岩蟲', spr: 'worm', pal: { a: '#ff7a3a', A: '#a8301a', L: '#ffc070', b: '#5a2418', B: '#2a0f0a' }, ai: 'burrow', hp: 70, r: 7, sp: 70, dmg: 14, shot: { k: 'efire', n: 10, ring: 1, v: 100, fx: 'burn' } },
  fireBat: { n: '火焰蝙蝠', spr: 'bat', pal: { a: '#ff6a2a', A: '#a8301a', L: '#ffc070', e: '#ffe14a' }, ai: 'fly', hp: 24, r: 5, sp: 82, dmg: 10, fx: 'burn' },
  magmaBomb: { n: '熔岩爆彈', spr: 'bomb', pal: { a: '#a8301a', A: '#5a1408', L: '#ff7a3a' }, ai: 'exploder', hp: 30, r: 6, sp: 60, dmg: 34, fx: 'burn', boom: 46 },
  obsidian: { n: '黑曜騎士', spr: 'armor', pal: { m: '#3a3448', M: '#1f1a2a', L: '#6a6080', a: '#ff5a2a', g: '#ff8a2a' }, ai: 'shield', hp: 140, r: 7, sp: 36, dmg: 18 },
  fireEye: { n: '熾焰之眼', spr: 'eye', pal: { a: '#a8301a', A: '#5a1408', L: '#ff7a3a', b: '#ffe14a', B: '#ff6a2a' }, ai: 'laser', hp: 60, r: 7, sp: 18, dmg: 22 },
  // 第四章
  frostGhost: { n: '冰霜幽魂', spr: 'ghost', pal: { a: '#a8e0ff', A: '#5a9ac8', L: '#ffffff' }, ai: 'kite', phase: 1, hp: 44, r: 6, sp: 46, dmg: 11, alpha: 0.75, shot: { k: 'ice', n: 1, v: 115, cd: 1.8, fx: 'slow' } },
  iceSkel: { n: '寒冰骷髏', spr: 'skel', pal: { w: '#d8f0ff', A: '#8ab0d0', g: '#5ff2ff' }, ai: 'kite', hp: 50, r: 6, sp: 44, dmg: 12, shot: { k: 'ice', n: 3, spr: 0.22, v: 125, cd: 2.2, fx: 'slow' } },
  necro: { n: '死靈法師', spr: 'robe', pal: { a: '#2a3a4a', A: '#141f2a', L: '#4a6a80', g: '#5ff2ff', s: '#d8d0c0' }, ai: 'summoner', hp: 70, r: 6, sp: 34, dmg: 12, sum: ['iceSkel', 'frostGhost'] },
  iceCrystal: { n: '冰晶塔', spr: 'crystal', pal: { ...P.ice, m: '#5a6a80', M: '#2a3448' }, ai: 'turret', hp: 80, r: 7, sp: 0, dmg: 11, shot: { k: 'ice', n: 10, ring: 1, v: 80, cd: 2.6, fx: 'slow' } },
  frostBeetle: { n: '冰霜甲蟲', spr: 'beetle', pal: { a: '#7ac8f0', A: '#3a7aa8', L: '#d8f4ff' }, ai: 'chase', hp: 140, r: 8, sp: 30, dmg: 15, armor: 0.3, fx: 'slow' },
  yeti: { n: '雪怪', spr: 'brute', pal: { a: '#e8f2ff', A: '#a8bcd8', L: '#ffffff', b: '#8ab0d0', B: '#4a6a90', r: '#3a8ab8', w: '#5ff2ff' }, ai: 'charge', hp: 170, r: 9, sp: 34, dmg: 22, scale: 1.15 },
  cryptSpider: { n: '墓穴蜘蛛', spr: 'spider', pal: { a: '#c8c0b0', A: '#7a7060', L: '#f0e8d8', e: '#5ff2ff' }, ai: 'leap', hp: 55, r: 6, sp: 60, dmg: 14, shot: { k: 'web', n: 3, spr: 0.25, v: 110, cd: 3, fx: 'slow' } },
  iceWisp: { n: '冰霜精靈', spr: 'wisp', pal: P.ice, ai: 'orbit', hp: 48, r: 6, sp: 70, dmg: 11, shot: { k: 'ice', n: 2, spr: 0.15, v: 130, cd: 1.5, fx: 'slow' } },
  // 第五章
  voidEye: { n: '虛空之眼', spr: 'eye', pal: { a: '#4a2a6e', A: '#1f0f38', L: '#8a5ac8', b: '#ff4af0', B: '#a01a90' }, ai: 'laser', hp: 90, r: 7, sp: 20, dmg: 26 },
  assassin: { n: '暗影刺客', spr: 'imp', pal: { a: '#2a1f3a', A: '#140e1f', L: '#5a4a7a', y: '#ff4af0' }, ai: 'blink', hp: 60, r: 6, sp: 50, dmg: 14, shot: { k: 'dark', n: 5, spr: 0.18, v: 160, cd: 2.6 } },
  voidSlime: { n: '虛空史萊姆', spr: 'slime', pal: P.void, ai: 'hop', hp: 100, r: 8, sp: 34, dmg: 15, scale: 1.2, split: { t: 'voidSlimeMini', n: 3 } },
  voidSlimeMini: { n: '虛空碎片', spr: 'slime', pal: P.void, ai: 'hop', hp: 24, r: 5, sp: 46, dmg: 9, scale: 0.7 },
  voidKnight: { n: '虛空騎士', spr: 'armor', pal: { m: '#4a2a6e', M: '#1f0f38', L: '#8a5ac8', a: '#ff4af0', g: '#ff4af0' }, ai: 'shield', hp: 200, r: 7, sp: 40, dmg: 20 },
  cultist: { n: '邪教祭司', spr: 'robe', pal: { a: '#6a1a2a', A: '#3a0a14', L: '#a83a4a', g: '#ff4af0', s: '#e8c0a0' }, ai: 'healer', hp: 70, r: 6, sp: 36, dmg: 12, shot: { k: 'dark', n: 1, v: 130, cd: 2 } },
  voidWorm: { n: '虛空蠕蟲', spr: 'worm', pal: { a: '#8a5ac8', A: '#4a2a6e', L: '#c8a0ff', b: '#1f0f38', B: '#0c0618' }, ai: 'burrow', hp: 110, r: 7, sp: 80, dmg: 16, shot: { k: 'dark', n: 14, ring: 1, v: 95 } },
  chaosWisp: { n: '混沌精靈', spr: 'wisp', pal: P.void, ai: 'orbit', hp: 60, r: 6, sp: 75, dmg: 12, shot: { k: 'dark', n: 3, spr: 0.25, v: 135, cd: 1.6 } },
  phantom: { n: '魅影', spr: 'ghost', pal: { a: '#c08cff', A: '#6a3ab0', L: '#f0e0ff' }, ai: 'kite', phase: 1, hp: 60, r: 6, sp: 52, dmg: 13, alpha: 0.7, shot: { k: 'dark', n: 2, spr: 0.12, v: 140, cd: 1.6 } },
  // 寶箱怪（每章不同）
  mimic1: { n: '石箱怪', spr: 'mimic', pal: { b: '#8a7a6a', B: '#4a4038' }, ai: 'mimic', hp: 160, r: 8, sp: 76, dmg: 20, shot: { k: 'rock', n: 10, ring: 1, v: 110 } },
  mimic2: { n: '苔箱怪', spr: 'mimic', pal: { b: '#4a7a3a', B: '#2a4a1a' }, ai: 'mimic', hp: 160, r: 8, sp: 76, dmg: 20, shot: { k: 'spore', n: 10, ring: 1, v: 100, fx: 'poison' } },
  mimic3: { n: '熔箱怪', spr: 'mimic', pal: { b: '#a8401a', B: '#5a1a08', y: '#ffe14a' }, ai: 'mimic', hp: 160, r: 8, sp: 76, dmg: 20, shot: { k: 'efire', n: 10, ring: 1, v: 110, fx: 'burn' } },
  mimic4: { n: '霜箱怪', spr: 'mimic', pal: { b: '#5a8ab0', B: '#2a4a6a', y: '#e8f8ff' }, ai: 'mimic', hp: 160, r: 8, sp: 76, dmg: 20, shot: { k: 'ice', n: 10, ring: 1, v: 100, fx: 'slow' } },
  mimic5: { n: '虛空箱怪', spr: 'mimic', pal: { b: '#4a2a6e', B: '#1f0f38', y: '#ff4af0' }, ai: 'mimic', hp: 160, r: 8, sp: 76, dmg: 20, shot: { k: 'dark', n: 10, ring: 1, v: 110 } },
  // 頭目機制用的單位
  banner: { n: '骷髏戰旗', spr: 'banner', pal: { y: '#c8202f', r: '#ffd34d' }, ai: 'static', hp: 150, r: 8, sp: 0, dmg: 0, noDrop: 1, scale: 1.8 },
  eggSac: { n: '蛛卵', spr: 'egg', pal: { a: '#d8e8c0', A: '#8aa070', L: '#ffffff', b: '#7ac04a' }, ai: 'static', hp: 55, r: 7, sp: 0, dmg: 0, noDrop: 1, scale: 1.4 },
  vineRoot: { n: '荊棘根', spr: 'root', pal: { a: '#4a8a3a', A: '#2a5a1a', L: '#8ad070' }, ai: 'turret', hp: 130, r: 9, sp: 0, dmg: 10, noDrop: 1, scale: 1.8, shot: { k: 'seed', n: 3, spr: 0.3, v: 105, cd: 3.5 } },
  shroomClone: { n: '蘑菇王分身', spr: 'shroomKing', ai: 'caster', hp: 110, r: 12, sp: 22, dmg: 12, scale: 2, noDrop: 1, shot: { k: 'spore', n: 8, ring: 1, v: 75, cd: 3, fx: 'poison' } },
  phylactery: { n: '巫妖命匣', spr: 'phyl', pal: { g: '#5ff2ff', L: '#e8f8ff', m: '#5a6a80', M: '#2a3448' }, ai: 'turret', hp: 240, r: 9, sp: 0, dmg: 10, noDrop: 1, scale: 1.8, shot: { k: 'ice', n: 8, ring: 1, v: 70, cd: 3.5, fx: 'slow' } },
  shadowClone: { n: '暗影複製體', spr: 'shadow', ai: 'kite', hp: 90, r: 6, sp: 62, dmg: 14, noDrop: 1, shot: { k: 'dark', n: 1, v: 150, cd: 1.2 } },
};

export const BOSSES = {
  // 第一章
  golem: { n: '巨岩魔像', spr: 'golem', ch: 1, hp: 1100, r: 15, sp: 28, dmg: 22, atks: ['slam', 'ring', 'charge', 'slam'], mech: 'armor', hint: '岩甲：傷害 -60%，打出破綻可擊碎岩甲；引誘牠撞牆會暈眩' },
  general: { n: '骷髏將軍', spr: 'general', ch: 1, hp: 1000, r: 13, sp: 36, dmg: 22, atks: ['charge', 'summon', 'ring', 'slam'], sum: ['skelWarrior', 'skelArcher'], mech: 'banner', hint: '戰旗：場上有戰旗時將軍受到的傷害 -80%，先摧毀戰旗！' },
  gargoyle: { n: '赤眼石像鬼', spr: 'gargoyle', ch: 1, hp: 620, r: 12, sp: 46, dmg: 20, atks: ['charge', 'spread', 'slam'], mech: 'twin', hint: '雙子：一隻倒下會石化 8 秒後復活，必須在時限內擊倒另一隻' },
  gargoyle2: { n: '蒼眼石像鬼', spr: 'gargoyle', ch: 1, hp: 620, r: 12, sp: 46, dmg: 20, atks: ['charge', 'ring', 'slam'], mech: 'twin', twinOnly: 1 },
  // 第二章
  queen: { n: '劇毒母蛛', spr: 'queen', ch: 2, hp: 1250, r: 15, sp: 42, dmg: 22, atks: ['leap', 'web', 'brood', 'poisonRain', 'leap'], mech: 'eggs', hint: '蛛卵：6 秒內不打破就會孵出小蜘蛛' },
  flowerKing: { n: '巨型食人花', spr: 'plant', ch: 2, hp: 1150, r: 15, sp: 0, dmg: 22, scale: 1.3, atks: ['seedStorm', 'vineLines', 'pollen', 'summon'], sum: ['flower'], mech: 'roots', hint: '荊棘根：根部存活時食人花無敵，摧毀 4 條根讓它枯萎（傷害 ×1.5）' },
  shroomKing: { n: '蘑菇王', spr: 'shroomKing', ch: 2, hp: 1150, r: 14, sp: 32, dmg: 20, atks: ['sporeRing', 'pollen', 'leap', 'summon'], sum: ['poisonSlime'], mech: 'clones', hint: '分身：血量 70%、40% 時召喚分身並與分身換位' },
  // 第三章
  dragon: { n: '熔岩飛龍', spr: 'dragon', ch: 3, hp: 1350, r: 14, sp: 38, dmg: 24, atks: ['breath', 'spread', 'meteor', 'charge'], mech: 'flight', hint: '飛空：飛上天時無法被攻擊，躲開隕石，牠落地時集中火力' },
  demon: { n: '烈焰惡魔', spr: 'demon', ch: 3, hp: 1400, r: 15, sp: 40, dmg: 24, atks: ['charge', 'fireWave', 'whip', 'summon'], sum: ['imp', 'fireBat'], mech: 'lava', hint: '熔岩：每次攻擊都會在地上留下熔岩，別被逼進角落' },
  core: { n: '爆炎核心', spr: 'core', ch: 3, hp: 1350, r: 14, sp: 22, dmg: 22, atks: ['ring', 'spread', 'sweep', 'summon'], sum: ['fireWisp'], mech: 'heat', hint: '過熱：熱度滿了會全場爆炸。打出破綻可散熱，或躲進藍色冷卻區' },
  // 第四章
  lich: { n: '冰霜巫妖', spr: 'lich', ch: 4, hp: 1400, r: 12, sp: 30, dmg: 24, atks: ['spiral', 'summon', 'blink', 'lasers', 'frostNova'], sum: ['iceSkel', 'frostGhost'], mech: 'phylactery', hint: '命匣：命匣存在時巫妖不會死亡，先摧毀命匣！' },
  icequeen: { n: '冰霜女王', spr: 'icequeen', ch: 4, hp: 1450, r: 13, sp: 32, dmg: 24, atks: ['frostNova', 'icicles', 'spiral', 'summon'], sum: ['iceWisp', 'frostGhost'], mech: 'blizzard', hint: '暴風雪：暴風雪來臨時躲到火盆旁取暖' },
  deathknight: { n: '亡魂騎士', spr: 'armor', ch: 4, hp: 1500, r: 13, sp: 42, dmg: 24, scale: 1.1, atks: ['charge', 'slam', 'lasers', 'summon'], sum: ['iceSkel', 'cryptSpider'], mech: 'mark', hint: '死亡印記：被標記的獵人要和隊友站在一起，分擔爆炸傷害' },
  // 第五章
  voidlord: { n: '虛空主宰', spr: 'voidlord', ch: 5, hp: 1900, r: 15, sp: 34, dmg: 26, atks: ['sweep', 'hell', 'summonEyes', 'blink', 'lasers', 'voidZones'], mech: 'blackhole', hint: '黑洞：黑洞會把人吸過去，往外跑！' },
  witch: { n: '時之魔女', spr: 'witch', ch: 5, hp: 1800, r: 13, sp: 34, dmg: 24, atks: ['spiral', 'blink', 'clock', 'summon'], sum: ['assassin', 'chaosWisp'], mech: 'timestop', hint: '時間停止：時間暫停時子彈會停在你身邊，恢復後同時射出——立刻翻滾！' },
  heart: { n: '深淵之心', spr: 'heart', ch: 5, hp: 2000, r: 15, sp: 20, dmg: 26, atks: ['pulse', 'hell', 'voidZones', 'tentacles'], mech: 'shadows', hint: '暗影複製：血量 75%、50%、25% 時召喚每位獵人的暗影分身' },
};

export const CHAPTERS = [
  { name: '石之迴廊', bosses: ['golem', 'general', 'gargoyle'], pool: ['slime', 'bat', 'skelArcher', 'skelWarrior', 'bomber', 'orc', 'shroom', 'rockling'] },
  { name: '苔蘚洞窟', bosses: ['queen', 'flowerKing', 'shroomKing'], pool: ['poisonSlime', 'spider', 'ghost', 'flower', 'sporeBat', 'beetle', 'goblin', 'mossBrute'] },
  { name: '熔岩深淵', bosses: ['dragon', 'demon', 'core'], pool: ['lavaSlime', 'fireBat', 'imp', 'magmaBomb', 'fireWisp', 'lavaWorm', 'obsidian', 'fireEye'] },
  { name: '冰封墓穴', bosses: ['lich', 'icequeen', 'deathknight'], pool: ['frostGhost', 'iceSkel', 'cryptSpider', 'frostBeetle', 'iceWisp', 'necro', 'iceCrystal', 'yeti'] },
  { name: '虛空王座', bosses: ['voidlord', 'witch', 'heart'], pool: ['voidSlime', 'assassin', 'phantom', 'chaosWisp', 'voidEye', 'voidKnight', 'cultist', 'voidWorm'] },
];
export const STAGES_PER_CHAPTER = 10;
// 每隻小怪所屬的章節（小怪只會出現在自己的章節）
const EXTRA = { slimeMini: 2, spiderling: 2, voidSlimeMini: 5, banner: 1, eggSac: 2, vineRoot: 2, shroomClone: 2, phylactery: 4, shadowClone: 5 };
CHAPTERS.forEach((c, i) => { for (const t of c.pool) ENEMIES[t].ch = i + 1; ENEMIES['mimic' + (i + 1)].ch = i + 1; });
for (const [t, c] of Object.entries(EXTRA)) ENEMIES[t].ch = c;

export const DOORS = {
  combat: { name: '戰鬥', color: '#ff6a6a', icon: '戰' },
  elite: { name: '精英戰', color: '#ffb02a', icon: '精' },
  supply: { name: '補給站', color: '#6aff9a', icon: '補' },
  forge: { name: '武器鍛造', color: '#8ad0ff', icon: '鍛' },
  chest: { name: '寶藏室', color: '#ffd34d', icon: '寶' },
  altar: { name: '血之祭壇', color: '#ff3a6a', icon: '祭' },
  boss: { name: '頭目', color: '#ff2a2a', icon: '王' },
  next: { name: '下一章', color: '#c9a7ff', icon: '進' },
};

export const SHOP = {
  potion: { name: '回復藥水', desc: '回復 50% 生命', cost: 15 },
  boon: { name: '增幅卷軸', desc: '獲得一次增幅選擇', cost: 40 },
  cross: { name: '復活十字', desc: '倒地時自動復活一次', cost: 60 },
  whet: { name: '磨刀石', desc: '武器等級 +1', cost: 45 },
};

// 魂晶結算
export function crystalsFor(r) {
  return Math.round(r.cleared * 4 + r.bossKills * 30 + r.kills / 4 + (r.win ? 300 : 0));
}
