# 深淵獵團 — AI 資產生成提示詞庫

遊戲內的角色與頭目目前由 `public/art.js` 程序化繪製（64×64 角色、96×96 頭目，含純黑墨影與霓虹發光），可以直接遊玩。
若想換成 AI 生成的正式美術或音樂，使用下列提示詞；音樂檔放進 `public/music/` 就會自動取代合成配樂（見文末）。

## 共用美術主提示詞

```
2D top-down pixel art, Hades Supergiant Games inspired aesthetic, heavy black ink chiaroscuro shadows, high-contrast vibrant neon magic effects, 64x64 crisp pixel art, dark obsidian dungeon
```

建議附加參數：
- Midjourney：`--ar 1:1 --style raw --no blur, anti-aliasing, gradient, 3d render, text, watermark`
- Stable Diffusion 負面提示：`blurry, anti-aliased, smooth shading, 3d, photorealistic, text, watermark, extra limbs, cropped`
- 角色精靈圖建議輸出 **4 方向 × 8 影格**的 sprite sheet，或至少「idle 4 影格＋run 6 影格」，透明背景，角色面朝右（遊戲內左右翻轉）。

---

## 角色：4 職業 × 4 造型（共 16 款）

每段都以共用主提示詞開頭，再接上下列描述。

### 職業 A：冥刃行者（近戰高機動刺客）

| 造型 | 英文提示詞 |
|---|---|
| 冥河叛逆者（預設） | `slender agile assassin, long flowing burning dark-red scarf trailing in the wind, black and crimson leather armor, dual-wielding obsidian short daggers, blood-red crescent slash trails, glowing red eyes, idle and run sprite sheet, transparent background` |
| 蒼藍雷鬼 | `slender agile assassin in deep purple samurai armor, flowing electric-blue lightning scarf crackling with sparks, high-frequency plasma tachi blades leaving cyan neon arcs, glowing cyan eyes, idle and run sprite sheet, transparent background` |
| 黃金太陽神衛 | `slender agile warrior in white-and-platinum Greek chiton, blazing golden light cape, twin sun-god golden blades with radiant yellow slash trails, sun halo glow, idle and run sprite sheet, transparent background` |
| 虛空骨刺 | `slender undead assassin wearing a white bone skull mask, ghostly emerald will-o-wisp flame cape, twin spine-bone daggers, green spectral slash trails, glowing green eye sockets, idle and run sprite sheet, transparent background` |

### 職業 B：星隕法師（遠程爆發與控場）

| 造型 | 英文提示詞 |
|---|---|
| 奧林匹斯占星者（預設） | `floating mage hovering 2 pixels above ground with flowing robe hem, huge hood hiding the upper face showing only two glowing eyes, deep blue starry night robe with gold constellation dots, holding a floating golden armillary orb, idle and run sprite sheet, transparent background` |
| 猩紅血月女巫 | `floating witch in dark crimson gothic long dress, large hood with glowing red eyes, holding a blood-red crystal ball, small bat particle effects swirling around, idle and run sprite sheet, transparent background` |
| 永凍霜寒祭司 | `floating priest in ice-crystal white and pale blue robe, hood with glowing cyan eyes, levitating icicle shards orbiting, frosty breath footprints, holding a frost orb, idle and run sprite sheet, transparent background` |
| 冥界死靈領主 | `floating necromancer in tattered dark-green burial shroud, hood with glowing green eyes, holding a skull relic burning with green fire, wisps of ghost flame, idle and run sprite sheet, transparent background` |

### 職業 C：重盾戰神（前排坦克與反擊，體型寬 20%）

| 造型 | 英文提示詞 |
|---|---|
| 青銅斯巴達（預設） | `broad heavy tank warrior 20 percent wider than others, ancient Greek bronze heavy armor with massive shoulder pauldrons, red feather crest helmet, giant round sun tower shield in left hand, heavy war hammer in right hand, heavy stomping walk cycle, idle and run sprite sheet, transparent background` |
| 黑曜石熔岩巨人 | `broad heavy tank warrior made of cracked black obsidian armor with molten orange lava glowing through the cracks, lava tower shield, magma war hammer, embers rising, heavy stomping walk cycle, idle and run sprite sheet, transparent background` |
| 聖殿白銀騎士 | `broad heavy tank paladin in polished bright silver plate armor, sky-blue light energy shield with a glowing cross emblem, cross-headed war hammer, blue cape, heavy stomping walk cycle, idle and run sprite sheet, transparent background` |
| 深海海神守衛 | `broad heavy tank guardian in coral and deep-sea blue scale armor, fin-crested helmet, trident and giant seashell tower shield, teal bioluminescent glow, bubble particles, heavy stomping walk cycle, idle and run sprite sheet, transparent background` |

### 職業 D：狩獵遊俠（遠程持續輸出與陷阱）

| 造型 | 英文提示詞 |
|---|---|
| 密林月神獵手（預設） | `light leather-armored huntress with a single-shoulder emerald green cloak, quiver of arrows on the back, glowing silver-white crescent moon longbow, bowstring and arrow glowing bright neon when drawn, idle and run sprite sheet, transparent background` |
| 烈焰鳳凰射手 | `light-armored archer with crimson phoenix feather cloak, burning flame longbow, fire arrows with blazing trails, ember particles, idle and run sprite sheet, transparent background` |
| 賽博霓虹遊俠 | `cyberpunk ranger in sleek black bodysuit, magenta holographic laser bow, cyan and magenta neon light lines, glitch particles, idle and run sprite sheet, transparent background` |
| 荒漠沙暴行者 | `desert ranger with sand-colored wind face mask and hood, bone composite bow, tan cloak, swirling sandstorm dust particles, idle and run sprite sheet, transparent background` |

---

## 頭目（15 隻，建議 128×128 或 96×96）

以共用主提示詞開頭，把 `64x64` 改成 `128x128 boss sprite`，再接上：

| 章節 | 頭目 | 英文提示詞 |
|---|---|---|
| 1 | 巨岩魔像 | `colossal stone golem with blocky rock body, cyan glowing cracks and eyes, moss patches, massive rock fists` |
| 1 | 骷髏將軍 | `skeleton general in dark plate armor with gold trim, horned helmet, tattered red cape, glowing red eye sockets, greatsword` |
| 1 | 雙子石像鬼 | `pair of winged stone gargoyles, one with red glowing eyes and one with blue glowing eyes, bat wings, curled tails, claws` |
| 2 | 劇毒母蛛 | `giant spider queen with eight segmented legs, golden crown, toxic neon-green markings on the abdomen, cluster of red eyes` |
| 2 | 巨型食人花 | `huge carnivorous flower with magenta petals, fanged mouth in the center, thick vine stem and leaves, yellow pollen glow` |
| 2 | 蘑菇王 | `mushroom king with a giant purple spotted cap, golden crown, cream stem body with a face, floating violet spores` |
| 3 | 熔岩飛龍 | `red wyvern dragon with spread purple wings, golden belly plates, horns, orange glowing fire in the throat` |
| 3 | 烈焰惡魔 | `muscular crimson demon with huge black horns, fiery mane, flaming whip in hand, glowing yellow eyes` |
| 3 | 爆炎核心 | `mechanical furnace core sphere on tripod legs, rotating metal rings, white-hot orange glowing core, heat vents` |
| 4 | 冰霜巫妖 | `floating lich in tattered dark blue robes, ice crystal crown, skull face, staff topped with a glowing cyan crystal` |
| 4 | 冰霜女王 | `elegant ice queen in a flaring pale blue gown, spiked ice crown, long white hair, orbiting ice shards` |
| 4 | 亡魂騎士 | `giant armored death knight in dark steel, cyan ghost flames from the helmet visor, huge greatsword, tattered cape` |
| 5 | 虛空主宰 | `gigantic floating eye with magenta iris, purple tentacles below, golden crown, void energy` |
| 5 | 時之魔女 | `witch with a tall pointed hat, clock halo with roman numerals behind her, starry robe, hourglass staff` |
| 5 | 深淵之心 | `pulsating anatomical heart monster with dark veins, three glowing magenta eyes, artery tentacles` |

## 場景與介面（選用）

- 冥界聖殿大廳：`2D top-down pixel art, Hades inspired underworld sanctuary hall, black obsidian floor with gold inlay lines, class weapon altars, tall golden mirror, wooden training dummies, glowing purple rune portal circle, heavy black ink shadows, neon cyan braziers, 16x16 tileset`
- 地牢圖塊：`2D top-down pixel art dungeon tileset 16x16, dark obsidian stone walls with heavy black ink shadows, cracked floor tiles, wall torches, five biome variants: stone corridor, mossy cave, lava abyss, frozen crypt, void throne`
- 技能圖示：`pixel art skill icon 32x32, Hades style, bold silhouette, neon glow on black, <技能名稱的英文描述>`

---

## 音樂（Suno / Udio）

| 用途 | 檔名 | 提示詞 |
|---|---|---|
| 大廳（冥界聖殿） | `public/music/hub.mp3` | `Dark Mediterranean folk rock, acoustic bouzouki, deep bassline, mysterious underworld sanctuary, chill loopable instrumental, 95 BPM` |
| 地牢戰鬥 | `public/music/dungeon.mp3` | `Fast-paced Mediterranean progressive rock, electric guitar riffs, bouzouki melody, heavy driving drums, 16-bit synth bass, Hades soundtrack style, 145 BPM` |
| BOSS 戰 | `public/music/boss.mp3` | `Epic mythological metal rock, intense electric guitar solo, choir chants, heavy percussion, high stakes boss battle music, 165 BPM` |
| 標題畫面（選用） | `public/music/title.mp3` | `Melancholic Mediterranean underworld theme, solo bouzouki and lyre over soft strings, distant choir, mysterious and heroic, loopable instrumental, 80 BPM` |

使用方式：生成後選「Instrumental」，裁成可無縫循環的片段，存成上表的檔名放進 `dungeon-coop/public/music/`。
伺服器會自動偵測（`/api/music`），有檔案的場景播放音檔，沒有的場景繼續使用內建晶片配樂。
