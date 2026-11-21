import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildData, DATA_FILES } from '../../src/core/data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export function loadDataSync() {
  const raw = {};
  for (const n of DATA_FILES) raw[n] = JSON.parse(readFileSync(join(root, 'data', `${n}.json`), 'utf8'));
  return buildData(raw);
}
export const ROOT = root;
/** 建立測試用的魚實例 */
export function fakeFish(uid, rows, cols, sp = 'f01') {
  return { uid, sp, w: 0.5, size: 'S', shape: [rows, cols], spot: 'A1', rod: 'rod1', bait: 'krill', at: 0 };
}
