import type { Point } from '../types/types.ts'
import { MAP_H, MAP_W, tileAt } from './map.ts'

export interface RayHit {
  dist: number
  side: number
  tile: number
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const

export function createRayHit(): RayHit {
  return { dist: 0, side: 0, tile: 0 }
}

export function castRay(ox: number, oy: number, dx: number, dy: number, out: RayHit): RayHit {
  let mapX = Math.floor(ox)
  let mapY = Math.floor(oy)
  const deltaX = dx === 0 ? 1e30 : Math.abs(1 / dx)
  const deltaY = dy === 0 ? 1e30 : Math.abs(1 / dy)
  const stepX = dx < 0 ? -1 : 1
  const stepY = dy < 0 ? -1 : 1
  let sideX = dx < 0 ? (ox - mapX) * deltaX : (mapX + 1 - ox) * deltaX
  let sideY = dy < 0 ? (oy - mapY) * deltaY : (mapY + 1 - oy) * deltaY

  for (let i = 0; i < 256; i++) {
    let side: number
    if (sideX < sideY) {
      sideX += deltaX
      mapX += stepX
      side = 0
    } else {
      sideY += deltaY
      mapY += stepY
      side = 1
    }

    const tile = tileAt(mapX, mapY)
    if (tile > 0) {
      out.dist = side === 0 ? sideX - deltaX : sideY - deltaY
      out.side = side
      out.tile = tile
      return out
    }
  }

  out.dist = Infinity
  out.side = 0
  out.tile = 0
  return out
}

const sightHit = createRayHit()

export function hasLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-6) return true
  return castRay(ax, ay, dx / dist, dy / dist, sightHit).dist > dist
}

export class FlowField {
  readonly dist = new Int16Array(MAP_W * MAP_H).fill(-1)
  private readonly queue = new Int32Array(MAP_W * MAP_H)
  private originX = -1
  private originY = -1

  update(x: number, y: number) {
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    if (tx === this.originX && ty === this.originY) return

    this.originX = tx
    this.originY = ty
    this.dist.fill(-1)

    const start = ty * MAP_W + tx
    let head = 0
    let tail = 0
    this.dist[start] = 0
    this.queue[tail++] = start

    while (head < tail) {
      const index = this.queue[head++]
      const cx = index % MAP_W
      const cy = (index - cx) / MAP_W

      for (let n = 0; n < 4; n++) {
        const nx = cx + NEIGHBORS[n][0]
        const ny = cy + NEIGHBORS[n][1]
        if (tileAt(nx, ny) > 0) continue

        const next = ny * MAP_W + nx
        if (this.dist[next] !== -1) continue

        this.dist[next] = this.dist[index] + 1
        this.queue[tail++] = next
      }
    }
  }

  next(x: number, y: number, out: Point): boolean {
    const tx = Math.floor(x)
    const ty = Math.floor(y)
    const here = tileAt(tx, ty) > 0 ? -1 : this.dist[ty * MAP_W + tx]
    if (here <= 0) return false

    let best = here
    let bestX = -1
    let bestY = -1

    for (const [ox, oy] of NEIGHBORS) {
      const nx = tx + ox
      const ny = ty + oy
      if (tileAt(nx, ny) > 0) continue
      if (ox !== 0 && oy !== 0 && (tileAt(tx + ox, ty) > 0 || tileAt(tx, ty + oy) > 0)) continue

      const d = this.dist[ny * MAP_W + nx]
      if (d >= 0 && d < best) {
        best = d
        bestX = nx
        bestY = ny
      }
    }

    if (bestX < 0) return false
    out.x = bestX + 0.5
    out.y = bestY + 0.5
    return true
  }
}
