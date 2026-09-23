export const TEX_SIZE = 64
export const TEX_SHIFT = 6
export const TEX_MASK = TEX_SIZE - 1

export type Texture = Uint32Array
type Rgb = [number, number, number]

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))

export function rgba(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function paint(seed: number, shader: (x: number, y: number, noise: number) => Rgb): Texture {
  const rand = createRng(seed)
  const texture = new Uint32Array(TEX_SIZE * TEX_SIZE)
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const [r, g, b] = shader(x, y, rand() * 2 - 1)
      texture[(y << TEX_SHIFT) | x] = rgba(r, g, b)
    }
  }
  return texture
}

const brick = paint(11, (x, y, noise) => {
  const row = y >> 4
  const shifted = (x + (row % 2) * 16) % TEX_SIZE
  const bx = shifted % 32
  const ly = y % 16
  if (ly < 2 || bx < 2) return [72 + noise * 6, 66 + noise * 6, 60 + noise * 6]

  const tone = hash(shifted >> 5, row) * 34 - 17
  let light = 1
  if (ly === 2 || bx === 2) light = 1.18
  if (ly === 15 || bx === 31) light = 0.72
  return [(152 + tone + noise * 12) * light, (64 + tone * 0.4 + noise * 7) * light, (48 + noise * 6) * light]
})

const stone = paint(23, (x, y, noise) => {
  const row = y >> 4
  const offset = Math.floor(hash(row, 5) * 32)
  const shifted = (x + offset) % TEX_SIZE
  const bx = shifted % 32
  const ly = y % 16
  if (ly < 1 || bx < 1) return [38, 40, 46]

  const tone = hash(shifted >> 5, row + 9) * 30 - 15
  const crack = hash(x * 7, y * 3) > 0.985 ? -45 : 0
  let light = 1
  if (ly === 1 || bx === 1) light = 1.22
  if (ly === 15 || bx === 31) light = 0.7
  const base = 112 + tone + noise * 14 + crack
  return [base * light, (base + 4) * light, (base + 14) * light]
})

const metal = paint(37, (x, y, noise) => {
  const px = x % 32
  const py = y % 32
  if (px === 0 || py === 0) return [34, 37, 42]
  if (px === 31 || py === 31) return [150, 156, 166]

  const rivet = [4, 27].some((rx) => [4, 27].some((ry) => Math.hypot(px - rx, py - ry) < 1.8))
  if (rivet) return [196, 202, 210]

  const brushed = hash(0, y) * 16 - 8
  const gradient = (1 - py / 32) * 22
  const base = 100 + brushed + gradient + noise * 4
  return [base, base + 5, base + 14]
})

const tech = paint(41, (x, y, noise) => {
  const py = y % 16
  if (py === 0) return [18, 20, 26]
  if (py === 1) return [70, 76, 90]

  const glow = Math.max(0, 1 - Math.abs(x - 31.5) / 5)
  const led = py === 8 && (x === 8 || x === 55)
  if (led) return y < 32 ? [255, 70, 60] : [80, 255, 120]

  const base = 40 + noise * 5
  return [base + glow * 30, base + 4 + glow * 190, base + 14 + glow * 230]
})

export const FLOOR_TEXTURE = paint(53, (x, y, noise) => {
  const px = x % 32
  const py = y % 32
  if (px === 0 || py === 0) return [36, 34, 32]

  const checker = ((x >> 5) + (y >> 5)) & 1
  const stain = hash(x >> 3, y >> 3) > 0.9 ? -14 : 0
  const base = (checker ? 96 : 80) + noise * 7 + stain
  return [base, base - 6, base - 14]
})

export const CEILING_TEXTURE = paint(67, (x, y, noise) => {
  const px = x % 32
  const py = y % 32
  if (x >= 18 && x < 46 && y >= 26 && y < 38) return [236, 232, 205]
  if (x >= 16 && x < 48 && y >= 24 && y < 40) return [90, 92, 100]
  if (px === 0 || py === 0) return [24, 24, 28]

  const base = 50 + noise * 5
  return [base, base, base + 8]
})

export const WALL_TEXTURES: Texture[] = [brick, brick, stone, metal, tech]
