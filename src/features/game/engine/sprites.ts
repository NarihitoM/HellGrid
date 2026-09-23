import type { EnemyKind, ParticleKind, PickupKind } from '../types/types.ts'

export interface Sprite {
  w: number
  h: number
  data: Uint32Array
}

export interface EnemyFrames {
  walkA: Sprite
  walkB: Sprite
  attack: Sprite
  pain: Sprite
  dead: Sprite
}

type Ctx = CanvasRenderingContext2D
type Pose = 'walkA' | 'walkB' | 'attack' | 'dead'

interface BeastPalette {
  light: string
  base: string
  dark: string
  eye: string
  horn: string
  bulk: number
}

const GRUNT: BeastPalette = {
  light: '#e67a52',
  base: '#a8402a',
  dark: '#561b10',
  eye: '#ffd84a',
  horn: '#efe3c8',
  bulk: 1,
}

const BRUTE: BeastPalette = {
  light: '#9cc062',
  base: '#58762f',
  dark: '#223012',
  eye: '#ff5a2e',
  horn: '#d8cfae',
  bulk: 1.3,
}

export function createCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser')
  return [canvas, ctx]
}

function draw(size: number, painter: (ctx: Ctx) => void): Sprite {
  const [, ctx] = createCanvas(size, size)
  painter(ctx)
  return { w: size, h: size, data: new Uint32Array(ctx.getImageData(0, 0, size, size).data.buffer) }
}

function tint(sprite: Sprite, amount: number): Sprite {
  const data = sprite.data.map((color) => {
    const r = (color & 255) + (255 - (color & 255)) * amount
    const g = ((color >>> 8) & 255) + (255 - ((color >>> 8) & 255)) * amount
    const b = ((color >>> 16) & 255) + (255 - ((color >>> 16) & 255)) * amount
    return ((color & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0
  })
  return { ...sprite, data }
}

export function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function shaded(ctx: Ctx, x: number, y: number, r: number, light: string, dark: string): CanvasGradient {
  const gradient = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
  gradient.addColorStop(0, light)
  gradient.addColorStop(1, dark)
  return gradient
}

export function burstFlash(ctx: Ctx, x: number, y: number, radius: number) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, 'rgba(255,255,240,1)')
  gradient.addColorStop(0.3, 'rgba(255,228,120,1)')
  gradient.addColorStop(0.65, 'rgba(255,140,30,0.85)')
  gradient.addColorStop(1, 'rgba(255,80,0,0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  const points = 18
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2 + 0.2
    const r = i % 2 === 0 ? radius : radius * 0.45
    ctx.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r * 0.85)
  }
  ctx.fill()
}

function drawBeast(ctx: Ctx, pose: Pose, c: BeastPalette) {
  const b = c.bulk

  if (pose === 'dead') {
    oval(ctx, 32, 59, 28, 5, '#4a0a06')
    oval(ctx, 28, 55, 16 * b, 6, shaded(ctx, 28, 55, 16, c.base, c.dark))
    oval(ctx, 47, 53, 6, 5, shaded(ctx, 47, 53, 6, c.light, c.dark))
    limb(ctx, 14, 56, 5, 60, 4, c.dark)
    limb(ctx, 50, 49, 57, 44, 2.5, c.horn)
    return
  }

  const step = pose === 'walkA' ? 1 : pose === 'walkB' ? -1 : 0
  const attack = pose === 'attack'

  limb(ctx, 26, 44, 24 + step * 5, 60, 7 * b, c.dark)
  limb(ctx, 38, 44, 40 - step * 5, 60, 7 * b, c.dark)
  oval(ctx, 23 + step * 5, 61.5, 5, 2.2, c.dark)
  oval(ctx, 41 - step * 5, 61.5, 5, 2.2, c.dark)

  const shoulder = 11 * b
  const hands = attack
    ? [
        [12, 9],
        [52, 9],
      ]
    : [
        [32 - 15 * b + step * 2, 45],
        [32 + 15 * b + step * 2, 45],
      ]
  limb(ctx, 32 - shoulder, 28, hands[0][0], hands[0][1], 6 * b, c.base)
  limb(ctx, 32 + shoulder, 28, hands[1][0], hands[1][1], 6 * b, c.base)
  for (const [hx, hy] of hands) {
    for (let claw = -1; claw <= 1; claw++) {
      limb(ctx, hx, hy, hx + claw * 3, hy + (attack ? -5 : 5), 1.5, c.horn)
    }
  }

  oval(ctx, 32, 34, 12 * b, 13, shaded(ctx, 32, 34, 14 * b, c.light, c.dark))
  ctx.globalAlpha = 0.45
  for (const ry of [31, 35, 39]) limb(ctx, 27, ry, 37, ry, 1.2, c.dark)
  ctx.globalAlpha = 1

  ctx.fillStyle = c.horn
  ctx.beginPath()
  ctx.moveTo(26, 14)
  ctx.quadraticCurveTo(19, 10, 20, 2)
  ctx.lineTo(29, 11)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(38, 14)
  ctx.quadraticCurveTo(45, 10, 44, 2)
  ctx.lineTo(35, 11)
  ctx.fill()

  oval(ctx, 32, 18, 8.5, 8, shaded(ctx, 32, 18, 9, c.light, c.dark))
  limb(ctx, 25.5, 15, 30, 16.5, 1.4, c.dark)
  limb(ctx, 38.5, 15, 34, 16.5, 1.4, c.dark)
  ctx.shadowColor = c.eye
  ctx.shadowBlur = 4
  oval(ctx, 28.5, 18, 2.2, 1.4, c.eye)
  oval(ctx, 35.5, 18, 2.2, 1.4, c.eye)
  ctx.shadowBlur = 0

  if (attack) {
    oval(ctx, 32, 23.5, 4, 3, '#2a0505')
    ctx.fillStyle = '#f5efe0'
    for (const tx of [29.5, 32, 34.5]) {
      ctx.beginPath()
      ctx.moveTo(tx - 1, 21)
      ctx.lineTo(tx + 1, 21)
      ctx.lineTo(tx, 23)
      ctx.fill()
    }
  } else {
    limb(ctx, 29, 23.5, 35, 23.5, 1.2, c.dark)
  }
}

function drawGunner(ctx: Ctx, pose: Pose) {
  const steel = '#6d7c8f'
  const dark = '#262d37'
  const light = '#b4c1d1'

  if (pose === 'dead') {
    oval(ctx, 32, 59, 27, 4.5, '#15181c')
    ctx.fillStyle = steel
    ctx.beginPath()
    ctx.roundRect(12, 50, 30, 9, 3)
    ctx.fill()
    ctx.fillStyle = dark
    ctx.beginPath()
    ctx.roundRect(42, 48, 11, 10, 3)
    ctx.fill()
    ctx.fillStyle = '#7a1a14'
    ctx.fillRect(44, 52, 7, 2)
    ctx.fillStyle = '#1c1f24'
    ctx.fillRect(4, 56, 12, 3)
    return
  }

  const step = pose === 'walkA' ? 1 : pose === 'walkB' ? -1 : 0

  limb(ctx, 27, 44, 25 + step * 4, 60, 7, dark)
  limb(ctx, 37, 44, 39 - step * 4, 60, 7, dark)
  oval(ctx, 26 + step * 2, 52, 3.6, 3, steel)
  oval(ctx, 38 - step * 2, 52, 3.6, 3, steel)
  oval(ctx, 24 + step * 4, 61.5, 5, 2.2, '#15181c')
  oval(ctx, 40 - step * 4, 61.5, 5, 2.2, '#15181c')

  limb(ctx, 21, 28, 19 - step, 43, 5.5, steel)
  oval(ctx, 19 - step, 44, 3, 3, dark)

  const torso = ctx.createLinearGradient(21, 22, 43, 45)
  torso.addColorStop(0, light)
  torso.addColorStop(1, '#3c4654')
  ctx.fillStyle = torso
  ctx.beginPath()
  ctx.roundRect(21, 22, 22, 23, 5)
  ctx.fill()
  ctx.fillStyle = '#56657a'
  ctx.beginPath()
  ctx.roundRect(25, 26, 14, 8, 2)
  ctx.fill()
  ctx.fillStyle = '#f0a030'
  ctx.fillRect(25, 37, 14, 2)
  oval(ctx, 20, 25, 5, 4, shaded(ctx, 20, 25, 5, light, steel))
  oval(ctx, 44, 25, 5, 4, shaded(ctx, 44, 25, 5, light, steel))

  const helmet = ctx.createLinearGradient(25, 7, 39, 21)
  helmet.addColorStop(0, light)
  helmet.addColorStop(1, '#3a4452')
  ctx.fillStyle = helmet
  ctx.beginPath()
  ctx.roundRect(25, 7, 14, 14, 4)
  ctx.fill()
  ctx.shadowColor = '#ff3b2f'
  ctx.shadowBlur = 5
  ctx.fillStyle = '#ff3b2f'
  ctx.fillRect(27, 12, 10, 3.5)
  ctx.shadowBlur = 0

  limb(ctx, 43, 28, 41, 36, 5.5, steel)
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.roundRect(35, 32, 14, 10, 2)
  ctx.fill()
  oval(ctx, 42, 37, 3.4, 3.4, '#3a414b')
  oval(ctx, 42, 37, 2, 2, '#050505')

  if (pose === 'attack') burstFlash(ctx, 42, 37, 11)
}

function beastFrames(palette: BeastPalette): EnemyFrames {
  const walkA = draw(64, (ctx) => drawBeast(ctx, 'walkA', palette))
  return {
    walkA,
    walkB: draw(64, (ctx) => drawBeast(ctx, 'walkB', palette)),
    attack: draw(64, (ctx) => drawBeast(ctx, 'attack', palette)),
    pain: tint(walkA, 0.55),
    dead: draw(64, (ctx) => drawBeast(ctx, 'dead', palette)),
  }
}

function gunnerFrames(): EnemyFrames {
  const walkA = draw(64, (ctx) => drawGunner(ctx, 'walkA'))
  return {
    walkA,
    walkB: draw(64, (ctx) => drawGunner(ctx, 'walkB')),
    attack: draw(64, (ctx) => drawGunner(ctx, 'attack')),
    pain: tint(walkA, 0.55),
    dead: draw(64, (ctx) => drawGunner(ctx, 'dead')),
  }
}

function dot(color: string): Sprite {
  return draw(8, (ctx) => oval(ctx, 4, 4, 3.2, 3.2, color))
}

const fireball = draw(32, (ctx) => {
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 15)
  gradient.addColorStop(0, '#fffbe6')
  gradient.addColorStop(0.3, '#ffd34d')
  gradient.addColorStop(0.7, '#ff7a1a')
  gradient.addColorStop(1, 'rgba(255,60,0,0)')
  oval(ctx, 16, 16, 15, 15, gradient)
})

const medkit = draw(32, (ctx) => {
  const box = ctx.createLinearGradient(0, 9, 0, 29)
  box.addColorStop(0, '#ffffff')
  box.addColorStop(1, '#b9c0c8')
  ctx.fillStyle = box
  ctx.beginPath()
  ctx.roundRect(4, 9, 24, 20, 3)
  ctx.fill()
  ctx.fillStyle = '#8a929c'
  ctx.fillRect(4, 13, 24, 1)
  ctx.fillStyle = '#d62828'
  ctx.fillRect(13, 15, 6, 12)
  ctx.fillRect(10, 18, 12, 6)
})

const bulletBox = draw(32, (ctx) => {
  for (let i = 0; i < 5; i++) {
    const x = 6 + i * 4.5
    ctx.fillStyle = '#d9ad3c'
    ctx.fillRect(x, 8, 3.4, 9)
    oval(ctx, x + 1.7, 8, 1.7, 2.6, '#b8732e')
  }
  ctx.fillStyle = '#4b5a2a'
  ctx.beginPath()
  ctx.roundRect(3, 15, 26, 14, 2)
  ctx.fill()
  ctx.fillStyle = '#c9b458'
  ctx.fillRect(8, 19, 16, 5)
})

const shellBox = draw(32, (ctx) => {
  for (let i = 0; i < 4; i++) {
    const x = 5.5 + i * 5.5
    ctx.fillStyle = '#c62f2f'
    ctx.fillRect(x, 5, 4.5, 11)
    ctx.fillStyle = '#e0b84e'
    ctx.fillRect(x, 14, 4.5, 4)
  }
  ctx.fillStyle = '#5a4632'
  ctx.beginPath()
  ctx.roundRect(3, 17, 26, 12, 2)
  ctx.fill()
  ctx.fillStyle = '#c62f2f'
  ctx.fillRect(7, 21, 18, 3)
})

export const ENEMY_SPRITES: Record<EnemyKind, EnemyFrames> = {
  grunt: beastFrames(GRUNT),
  brute: beastFrames(BRUTE),
  gunner: gunnerFrames(),
}

export const PARTICLE_SPRITES: Record<ParticleKind, Sprite> = {
  spark: dot('#ffe9a8'),
  blood: dot('#a01212'),
  ember: dot('#ff9a2e'),
  portal: dot('#b57bff'),
}

export const PICKUP_SPRITES: Record<PickupKind, Sprite> = {
  health: medkit,
  bullets: bulletBox,
  shells: shellBox,
}

export const FIREBALL_SPRITE = fireball
