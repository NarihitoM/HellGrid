import { MAP_H, MAP_W, tileAt } from './map.ts'
import { castRay, createRayHit } from './nav.ts'
import { ENEMY_SPRITES, FIREBALL_SPRITE, PARTICLE_SPRITES, PICKUP_SPRITES, createCanvas, type Sprite } from './sprites.ts'
import { CEILING_TEXTURE, FLOOR_TEXTURE, TEX_MASK, TEX_SHIFT, TEX_SIZE, WALL_TEXTURES } from './textures.ts'
import { drawViewModel } from './viewmodels.ts'
import { WEAPONS } from './weapons.ts'
import { ENEMY_STATS, INSPECT_TIME, SWITCH_TIME, type World } from './world.ts'

const FOV_DEGREES = 75
const PLANE = Math.tan((FOV_DEGREES * Math.PI) / 360)
const FOG_DISTANCE = 15
const MINIMAP_COLORS = ['', '#8a3b2a', '#6f7784', '#8e96a3', '#2aa7c9']

interface SpriteDraw {
  sprite: Sprite
  x: number
  y: number
  z: number
  size: number
  bright: boolean
  dist: number
}

interface View {
  x: number
  y: number
  dirX: number
  dirY: number
  planeX: number
  planeY: number
  eyeZ: number
  horizon: number
  flash: number
}

function shade(color: number, s: number): number {
  return (
    0xff000000 |
    ((((color >>> 16) & 255) * s) >> 8 << 16) |
    ((((color >>> 8) & 255) * s) >> 8 << 8) |
    (((color & 255) * s) >> 8)
  )
}

function light(dist: number, flash: number): number {
  const base = Math.max(0.1, 1 - dist / FOG_DISTANCE)
  const lit = base + flash * Math.max(0, 0.55 - dist * 0.06)
  return Math.min(256, (lit * 256) | 0)
}

export class Renderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hit = createRayHit()
  private readonly draws: SpriteDraw[] = []
  private readonly view: View = { x: 0, y: 0, dirX: 1, dirY: 0, planeX: 0, planeY: PLANE, eyeZ: 0.5, horizon: 0, flash: 0 }
  private image: ImageData
  private pixels = new Uint32Array(0)
  private depth = new Float32Array(0)
  private width = 0
  private height = 0
  private projScale = 1
  private minimap: HTMLCanvasElement | null = null
  private minimapCell = 2
  private vignette: CanvasGradient | null = null

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser')
    this.canvas = canvas
    this.ctx = ctx
    this.image = ctx.createImageData(1, 1)
  }

  resize(width: number, height: number) {
    this.canvas.width = width
    this.canvas.height = height
    this.width = width
    this.height = height
    this.projScale = width / (2 * PLANE)
    this.image = this.ctx.createImageData(width, height)
    this.pixels = new Uint32Array(this.image.data.buffer)
    this.depth = new Float32Array(width)
    this.ctx.imageSmoothingEnabled = false

    this.vignette = this.ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, width * 0.7)
    this.vignette.addColorStop(0, 'rgba(0,0,0,0)')
    this.vignette.addColorStop(1, 'rgba(0,0,0,0.6)')

    this.minimapCell = Math.max(2, Math.round(height / 110))
    const [minimap, mctx] = createCanvas(MAP_W * this.minimapCell, MAP_H * this.minimapCell)
    mctx.fillStyle = 'rgba(8,10,14,0.8)'
    mctx.fillRect(0, 0, minimap.width, minimap.height)
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const tile = tileAt(x, y)
        if (tile === 0) continue
        mctx.fillStyle = MINIMAP_COLORS[tile] ?? MINIMAP_COLORS[1]
        mctx.fillRect(x * this.minimapCell, y * this.minimapCell, this.minimapCell, this.minimapCell)
      }
    }
    this.minimap = minimap
  }

  render(world: World) {
    const p = world.player
    const v = this.view
    const dead = p.health <= 0

    const plane = PLANE / p.zoom
    this.projScale = this.width / (2 * plane)

    v.x = p.x
    v.y = p.y
    v.dirX = Math.cos(p.angle)
    v.dirY = Math.sin(p.angle)
    v.planeX = -v.dirY * plane
    v.planeY = v.dirX * plane
    v.eyeZ = dead
      ? Math.max(0.1, 0.5 - p.deathTime * 0.3)
      : 0.5 + Math.sin(p.bob * 2) * 0.012 * Math.min(1, p.moving) * (1 - p.aim * 0.7)
    v.horizon = this.height / 2 + p.pitch * this.height * 0.5 * p.zoom
    v.flash = p.muzzle > 0 ? 1 : 0

    this.drawPlanes()
    this.drawWalls()
    this.drawSprites(world)
    this.ctx.putImageData(this.image, 0, 0)

    if (world.scoped) this.drawScope(world)
    else if (!dead) this.drawWeapon(world)
    this.drawEffects(world)
    this.drawMinimap(world)
  }

  private drawPlanes() {
    const { width: W, height: H, pixels, projScale, view: v } = this
    const r0x = v.dirX - v.planeX
    const r0y = v.dirY - v.planeY
    const r1x = v.dirX + v.planeX
    const r1y = v.dirY + v.planeY

    for (let y = 0; y < H; y++) {
      const offset = y + 0.5 - v.horizon
      const isFloor = offset > 0
      const dist = ((isFloor ? v.eyeZ : 1 - v.eyeZ) * projScale) / Math.abs(offset)
      const row = y * W

      if (dist > FOG_DISTANCE * 2) {
        pixels.fill(0xff000000, row, row + W)
        continue
      }

      const s = light(dist, v.flash)
      const texture = isFloor ? FLOOR_TEXTURE : CEILING_TEXTURE
      const stepX = (dist * (r1x - r0x)) / W
      const stepY = (dist * (r1y - r0y)) / W
      let fx = v.x + dist * r0x
      let fy = v.y + dist * r0y

      for (let x = 0; x < W; x++) {
        const tx = (fx * TEX_SIZE) & TEX_MASK
        const ty = (fy * TEX_SIZE) & TEX_MASK
        pixels[row + x] = shade(texture[(ty << TEX_SHIFT) | tx], s)
        fx += stepX
        fy += stepY
      }
    }
  }

  private drawWalls() {
    const { width: W, height: H, pixels, depth, projScale, view: v } = this

    for (let x = 0; x < W; x++) {
      const camera = (2 * x + 1) / W - 1
      const rayX = v.dirX + v.planeX * camera
      const rayY = v.dirY + v.planeY * camera
      const hit = castRay(v.x, v.y, rayX, rayY, this.hit)
      const dist = Math.max(0.0001, hit.dist)
      depth[x] = dist

      const lineHeight = projScale / dist
      const top = v.horizon - (1 - v.eyeZ) * lineHeight
      const bottom = v.horizon + v.eyeZ * lineHeight

      let wallX = hit.side === 0 ? v.y + dist * rayY : v.x + dist * rayX
      wallX -= Math.floor(wallX)
      let tx = (wallX * TEX_SIZE) | 0
      if ((hit.side === 0 && rayX > 0) || (hit.side === 1 && rayY < 0)) tx = TEX_MASK - tx

      const texture = WALL_TEXTURES[hit.tile] ?? WALL_TEXTURES[1]
      const s = (light(dist, v.flash) * (hit.side === 1 ? 0.75 : 1)) | 0
      const y0 = Math.max(0, Math.ceil(top - 0.5))
      const y1 = Math.min(H, Math.ceil(bottom - 0.5))
      const step = TEX_SIZE / (bottom - top)
      let texPos = (y0 + 0.5 - top) * step

      for (let y = y0; y < y1; y++) {
        const ty = (texPos | 0) & TEX_MASK
        pixels[y * W + x] = shade(texture[(ty << TEX_SHIFT) | tx], s)
        texPos += step
      }
    }
  }

  private queueSprite(sprite: Sprite, x: number, y: number, z: number, size: number, bright: boolean) {
    const dx = x - this.view.x
    const dy = y - this.view.y
    this.draws.push({ sprite, x, y, z, size, bright, dist: dx * dx + dy * dy })
  }

  private drawSprites(world: World) {
    this.draws.length = 0

    for (const e of world.enemies) {
      const frames = ENEMY_SPRITES[e.kind]
      let sprite = Math.floor(e.walk) % 2 === 0 ? frames.walkA : frames.walkB
      if (e.state === 'dead') sprite = frames.dead
      else if (e.state === 'attack') sprite = frames.attack
      else if (e.state === 'pain' || e.flash > 0) sprite = frames.pain
      this.queueSprite(sprite, e.x, e.y, 0, ENEMY_STATS[e.kind].size, false)
    }

    for (const pickup of world.pickups) {
      if (!pickup.active) continue
      const hover = 0.03 + Math.sin(world.time * 3 + pickup.x * 2) * 0.03
      this.queueSprite(PICKUP_SPRITES[pickup.kind], pickup.x, pickup.y, hover, 0.34, false)
    }

    for (const shot of world.projectiles) {
      this.queueSprite(FIREBALL_SPRITE, shot.x, shot.y, shot.z - 0.14, 0.28, true)
    }

    for (const particle of world.particles) {
      this.queueSprite(PARTICLE_SPRITES[particle.kind], particle.x, particle.y, particle.z, 0.06, particle.kind !== 'blood')
    }

    this.draws.sort((a, b) => b.dist - a.dist)
    for (const draw of this.draws) this.drawSprite(draw)
  }

  private drawSprite(draw: SpriteDraw) {
    const { width: W, height: H, pixels, depth, projScale, view: v } = this
    const sx = draw.x - v.x
    const sy = draw.y - v.y
    const invDet = 1 / (v.planeX * v.dirY - v.dirX * v.planeY)
    const tx = invDet * (v.dirY * sx - v.dirX * sy)
    const ty = invDet * (-v.planeY * sx + v.planeX * sy)
    if (ty < 0.15) return

    const scale = projScale / ty
    const height = draw.size * scale
    const width = (height * draw.sprite.w) / draw.sprite.h
    const screenX = (W / 2) * (1 + tx / ty)
    const bottom = v.horizon + (v.eyeZ - draw.z) * scale
    const top = bottom - height
    const left = screenX - width / 2

    const x0 = Math.max(0, Math.ceil(left - 0.5))
    const x1 = Math.min(W, Math.ceil(left + width - 0.5))
    const y0 = Math.max(0, Math.ceil(top - 0.5))
    const y1 = Math.min(H, Math.ceil(bottom - 0.5))
    if (x0 >= x1 || y0 >= y1) return

    const { w: sw, h: sh, data } = draw.sprite
    const s = draw.bright ? 256 : light(ty, v.flash)
    const uStep = sw / width
    const vStep = sh / height

    for (let x = x0; x < x1; x++) {
      if (ty >= depth[x]) continue
      const u = Math.min(sw - 1, ((x + 0.5 - left) * uStep) | 0)
      let vPos = (y0 + 0.5 - top) * vStep

      for (let y = y0; y < y1; y++) {
        const color = data[Math.min(sh - 1, vPos | 0) * sw + u]
        vPos += vStep
        if (color >>> 24 > 127) pixels[y * W + x] = shade(color, s)
      }
    }
  }

  private drawWeapon(world: World) {
    const { ctx, width: W, height: H } = this
    const p = world.player
    const spec = WEAPONS[p.weapon]
    const unit = Math.min(W / 640, H / 360)
    const hip = 1 - p.aim
    const moving = Math.min(1, p.moving) * (1 + p.sprint * 0.6)

    let x = W * 0.74
    let y = H * 0.86
    let rotation = 0.36
    let scaleX = 1

    x += Math.cos(p.bob) * 12 * moving * unit * (1 - p.aim * 0.8)
    y += Math.abs(Math.sin(p.bob)) * 9 * moving * unit * (1 - p.aim * 0.8)
    y += Math.sin(world.time * 1.7) * 3 * unit * hip
    rotation += Math.sin(world.time * 1.1) * 0.01 * hip

    x -= p.swayX * W * 0.2
    y -= p.swayY * H * 0.2
    rotation += p.swayX * 0.35 - p.swayY * 0.2
    x += p.lean * 10 * unit
    rotation -= p.lean * 0.05

    x += p.kick * 16 * unit
    y += p.kick * 8 * unit
    rotation += p.kick * (p.weapon === 'rifle' ? 0.05 : 0.16)

    const switching = p.switching / SWITCH_TIME
    y += switching * H * 0.55
    rotation -= switching * 0.4

    y += p.sprint * 50 * unit
    x += p.sprint * 30 * unit
    rotation -= p.sprint * 0.55

    let mag = 0
    let slide = p.weapon === 'pistol' || p.weapon === 'rifle' ? p.kick : 0
    if (p.weapon === 'shotgun' || p.weapon === 'sniper') {
      const cycle = 1 - Math.max(0, p.cooldown) / spec.cooldown
      if (p.cooldown > 0 && cycle > 0.25) slide = Math.sin(((cycle - 0.25) / 0.6) * Math.PI) * (cycle < 0.85 ? 1 : 0)
    }

    if (p.reloading > 0) {
      const r = 1 - p.reloading / spec.reloadTime
      const dip = Math.sin(r * Math.PI)
      y += dip * 60 * unit
      x -= dip * 20 * unit
      rotation += dip * 0.3
      mag = r < 0.25 ? r / 0.25 : r < 0.6 ? 1 : Math.max(0, 1 - (r - 0.6) / 0.25)
      if (r > 0.85) slide = Math.sin(((r - 0.85) / 0.15) * Math.PI)
    }

    if (p.inspecting > 0) {
      const i = 1 - p.inspecting / INSPECT_TIME
      const blend = Math.sin(i * Math.PI)
      x -= blend * W * 0.14
      y -= blend * H * 0.04
      rotation -= blend * 0.5 + Math.sin(i * Math.PI * 3) * 0.12 * blend
      scaleX = 1 - Math.sin(i * Math.PI * 2) ** 2 * 0.45
    }

    x += (W * 0.62 - x) * p.aim
    y += (H * 0.8 - y) * p.aim
    rotation += (0.22 - rotation) * p.aim * 0.8

    const size = unit * (p.weapon === 'pistol' ? 1.2 : 0.9) * (1 + p.aim * 0.1)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.scale(size * scaleX * 0.62, size)
    drawViewModel(ctx, p.weapon, { flash: p.muzzle > 0, slide, mag })
    ctx.restore()
  }

  private drawScope(world: World) {
    const { ctx, width: W, height: H } = this
    const p = world.player
    const cx = W / 2 - p.swayX * W * 0.05
    const cy = H / 2 - p.swayY * H * 0.05
    const radius = H * 0.47

    const lens = ctx.createRadialGradient(cx, cy, radius * 0.75, cx, cy, radius)
    lens.addColorStop(0, 'rgba(0,0,0,0)')
    lens.addColorStop(1, 'rgba(0,0,0,0.75)')
    ctx.fillStyle = lens
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.rect(0, 0, W, H)
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill('evenodd')

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - radius, cy)
    ctx.lineTo(cx + radius, cy)
    ctx.moveTo(cx, cy - radius)
    ctx.lineTo(cx, cy + radius)
    ctx.stroke()

    ctx.lineWidth = 4
    ctx.beginPath()
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1]]) {
      ctx.moveTo(cx + dx * radius * 0.45, cy + dy * radius * 0.45)
      ctx.lineTo(cx + dx * radius, cy + dy * radius)
    }
    ctx.stroke()

    ctx.fillStyle = '#ff3030'
    ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2)
  }

  private drawEffects(world: World) {
    const { ctx, width, height } = this
    const p = world.player

    if (this.vignette) {
      ctx.fillStyle = this.vignette
      ctx.fillRect(0, 0, width, height)
    }
    if (p.hurt > 0) {
      ctx.fillStyle = `rgba(200,0,0,${p.hurt * 0.35})`
      ctx.fillRect(0, 0, width, height)
    }
    if (p.glow > 0) {
      ctx.fillStyle = `rgba(255,220,120,${p.glow * 0.2})`
      ctx.fillRect(0, 0, width, height)
    }
    if (p.health <= 0) {
      ctx.fillStyle = `rgba(110,0,0,${Math.min(0.55, p.deathTime * 0.4)})`
      ctx.fillRect(0, 0, width, height)
    }
  }

  private drawMinimap(world: World) {
    if (!this.minimap) return
    const { ctx, minimapCell: cell } = this
    const ox = this.width - this.minimap.width - 8
    const oy = 8
    const p = world.player

    ctx.drawImage(this.minimap, ox, oy)

    ctx.fillStyle = '#5ee37a'
    for (const pickup of world.pickups) {
      if (pickup.active) ctx.fillRect(ox + pickup.x * cell - 1, oy + pickup.y * cell - 1, 2, 2)
    }

    ctx.fillStyle = '#ff3b30'
    for (const e of world.enemies) {
      if (e.state !== 'dead') ctx.fillRect(ox + e.x * cell - 1.5, oy + e.y * cell - 1.5, 3, 3)
    }

    const px = ox + p.x * cell
    const py = oy + p.y * cell
    const half = (FOV_DEGREES * Math.PI) / 360
    ctx.fillStyle = 'rgba(255,200,90,0.18)'
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + Math.cos(p.angle - half) * cell * 5, py + Math.sin(p.angle - half) * cell * 5)
    ctx.lineTo(px + Math.cos(p.angle + half) * cell * 5, py + Math.sin(p.angle + half) * cell * 5)
    ctx.fill()
    ctx.fillStyle = '#ffc85a'
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
  }
}
