import type { PickupKind, Point } from '../types/types.ts'

export interface PickupSpot extends Point {
  kind: PickupKind
}

export const MAP_LAYOUT = [
  '1111111111111111111111111111',
  '1S........1......1........S1',
  '1.........1..h...1.........1',
  '1..22.....1......1.....22..1',
  '1..22..................22..1',
  '1.........1......1.......b.1',
  '1111.111111......1111111.111',
  '1.........3......3.........1',
  '1.s.......3......3.......h.1',
  '1...4.....33....33....4....1',
  '1..........................1',
  '1..........................1',
  '1....4......2..2......4....1',
  '1...........2..2...........1',
  '1..........................1',
  '1....4...P..........b..4...1',
  '1..........................1',
  '11111.1111111....1111111.111',
  '1...........2....2.........1',
  '1.S.........2....2.......S.1',
  '1...33......2....2...33....1',
  '1...33...........2...33....1',
  '1...........2.........s....1',
  '1..h........2....2.........1',
  '1...........2....2.......b.1',
  '1.S.........2....2.......S.1',
  '1...........2....2.........1',
  '1111111111111111111111111111',
]

const PICKUP_CHARS: Record<string, PickupKind> = { h: 'health', b: 'bullets', s: 'shells' }

export const MAP_W = MAP_LAYOUT[0].length
export const MAP_H = MAP_LAYOUT.length
export const tiles = new Uint8Array(MAP_W * MAP_H)
export const playerStart: Point = { x: 1.5, y: 1.5 }
export const spawnPoints: Point[] = []
export const pickupSpots: PickupSpot[] = []

MAP_LAYOUT.forEach((row, y) => {
  for (let x = 0; x < MAP_W; x++) {
    const char = row[x]
    const center = { x: x + 0.5, y: y + 0.5 }

    if (char >= '1' && char <= '9') tiles[y * MAP_W + x] = Number(char)
    else if (char === 'P') Object.assign(playerStart, center)
    else if (char === 'S') spawnPoints.push(center)
    else if (char in PICKUP_CHARS) pickupSpots.push({ ...center, kind: PICKUP_CHARS[char] })
  }
})

export function tileAt(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return 1
  return tiles[y * MAP_W + x]
}

export function isSolid(x: number, y: number): boolean {
  return tileAt(Math.floor(x), Math.floor(y)) > 0
}
