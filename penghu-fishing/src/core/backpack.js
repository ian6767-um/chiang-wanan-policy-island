// 格子背包。座標：x = 欄（左→右），y = 列（上→下）。形狀以 [列數, 欄數] 表示。
// 物品：{ uid, fish, x, y, rot }，fish.shape 為未旋轉時的 [rows, cols]。

export function itemDims(shape, rot) {
  const [r, c] = shape;
  return rot ? { h: c, w: r } : { h: r, w: c };
}

export class Backpack {
  constructor(rows, cols, items = []) {
    this.rows = rows;
    this.cols = cols;
    this.items = [];
    for (const it of items) this.items.push({ ...it });
  }

  static fromJSON(o) {
    return new Backpack(o.rows, o.cols, o.items || []);
  }

  toJSON() {
    return { rows: this.rows, cols: this.cols, items: this.items.map((i) => ({ ...i })) };
  }

  get totalCells() { return this.rows * this.cols; }

  get usedCells() {
    let n = 0;
    for (const it of this.items) n += it.fish.shape[0] * it.fish.shape[1];
    return n;
  }

  /** 傳回格子佔用表：grid[y][x] = uid 或 null */
  occupancy(ignoreUid = null) {
    const grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    for (const it of this.items) {
      if (it.uid === ignoreUid) continue;
      const { w, h } = itemDims(it.fish.shape, it.rot);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const gy = it.y + yy, gx = it.x + xx;
        if (gy >= 0 && gy < this.rows && gx >= 0 && gx < this.cols) grid[gy][gx] = it.uid;
      }
    }
    return grid;
  }

  /** item 可以是背包內的物品（移動時會忽略自己）或新物品 { fish, uid } */
  canPlace(item, x, y, rot, grid = null) {
    const { w, h } = itemDims(item.fish.shape, rot);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || y < 0 || x + w > this.cols || y + h > this.rows) return false;
    const g = grid || this.occupancy(item.uid);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const o = g[y + yy][x + xx];
      if (o !== null && o !== item.uid) return false;
    }
    return true;
  }

  /** 尋找可放的位置：先由上到下、再由左到右（逐欄掃描），每個位置兩種方向都試 */
  findSpot(item) {
    const grid = this.occupancy(item.uid);
    const rots = item.fish.shape[0] === item.fish.shape[1] ? [false] : [false, true];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        for (const rot of rots) {
          if (this.canPlace(item, x, y, rot, grid)) return { x, y, rot };
        }
      }
    }
    return null;
  }

  autoPlace(item) {
    const spot = this.findSpot(item);
    if (!spot) return false;
    this.items.push({ uid: item.uid, fish: item.fish, x: spot.x, y: spot.y, rot: spot.rot });
    return true;
  }

  place(item, x, y, rot) {
    if (!this.canPlace(item, x, y, rot)) return false;
    this.items.push({ uid: item.uid, fish: item.fish, x, y, rot: !!rot });
    return true;
  }

  get(uid) { return this.items.find((i) => i.uid === uid) || null; }

  remove(uid) {
    const idx = this.items.findIndex((i) => i.uid === uid);
    if (idx < 0) return null;
    return this.items.splice(idx, 1)[0];
  }

  move(uid, x, y, rot) {
    const it = this.get(uid);
    if (!it) return false;
    if (!this.canPlace(it, x, y, rot)) return false;
    it.x = x; it.y = y; it.rot = !!rot;
    return true;
  }

  itemAt(x, y) {
    const g = this.occupancy();
    if (y < 0 || x < 0 || y >= this.rows || x >= this.cols) return null;
    const uid = g[y][x];
    return uid === null ? null : this.get(uid);
  }

  /** 升級尺寸：只能變大，原有物品位置不變 */
  resize(rows, cols) {
    if (rows < this.rows || cols < this.cols) throw new Error('背包只能變大');
    this.rows = rows; this.cols = cols;
  }

  /** 檢查內部狀態是否合法（沒有重疊、沒有超出邊界） */
  isValid() {
    const seen = Array.from({ length: this.rows }, () => Array(this.cols).fill(false));
    for (const it of this.items) {
      const { w, h } = itemDims(it.fish.shape, it.rot);
      if (it.x < 0 || it.y < 0 || it.x + w > this.cols || it.y + h > this.rows) return false;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        if (seen[it.y + yy][it.x + xx]) return false;
        seen[it.y + yy][it.x + xx] = true;
      }
    }
    return true;
  }
}
