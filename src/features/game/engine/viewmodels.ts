import type { WeaponId } from '../types/types.ts'
import { burstFlash, oval } from './sprites.ts'

type Ctx = CanvasRenderingContext2D

export interface ViewModelPose {
  flash: boolean
  slide: number
  mag: number
}

function polygon(ctx: Ctx, fill: string | CanvasGradient, points: number[]) {
  ctx.fillStyle = fill
  ctx.beginPath()
  for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1])
  ctx.closePath()
  ctx.fill()
}

function steel(ctx: Ctx, y0: number, y1: number, stops: string[]): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1)
  stops.forEach((color, i) => gradient.addColorStop(i / (stops.length - 1), color))
  return gradient
}

function wood(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  return steel(ctx, y0, y1, ['#a4652f', '#7a4520', '#3e220e'])
}

function glove(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  const gradient = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.5, 2, x, y, rx)
  gradient.addColorStop(0, '#5a4a3d')
  gradient.addColorStop(1, '#1f1813')
  oval(ctx, x, y, rx, ry, gradient)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 2
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(x + i * rx * 0.4, y - ry * 0.7)
    ctx.lineTo(x + i * rx * 0.4 + 3, y + ry * 0.3)
    ctx.stroke()
  }
}

function sleeve(ctx: Ctx, points: number[]) {
  polygon(ctx, steel(ctx, points[1], points[points.length - 1], ['#4a5a41', '#303c29', '#1c2418']), points)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(points[0], points[1])
  ctx.lineTo(points[0] + (points[4] - points[0]) * 0.6, points[1] + (points[5] - points[1]) * 0.6)
  ctx.stroke()
}

function rightArm(ctx: Ctx, x: number, y: number) {
  sleeve(ctx, [x - 4, y + 12, x + 52, y - 20, x + 520, y + 180, x + 520, y + 520, x + 240, y + 520])
  glove(ctx, x, y, 36, 26)
}

function leftArm(ctx: Ctx, x: number, y: number) {
  sleeve(ctx, [x - 38, y + 8, x + 30, y + 10, x + 300, y + 520, x + 20, y + 520])
  glove(ctx, x, y, 40, 22)
}

function pistol(ctx: Ctx, pose: ViewModelPose) {
  const back = pose.slide * 22
  leftArm(ctx, -6, 34)
  polygon(ctx, '#1b1d21', [-24, -10, 10, -10, 26, 46, -4, 50])
  ctx.strokeStyle = '#1b1d21'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(-40, -4, 14, 0.1, Math.PI - 0.3)
  ctx.stroke()
  polygon(ctx, '#23262b', [-112, -14, 12, -14, 12, -2, -100, -2])
  polygon(ctx, steel(ctx, -40, -12, ['#9aa2ac', '#5a616b', '#2a2e33']), [
    -134 + back, -38, 18 + back, -38, 20 + back, -12, -134 + back, -12,
  ])
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  for (let i = 0; i < 5; i++) ctx.fillRect(-6 + back + i * 4, -34, 2, 18)
  ctx.fillStyle = '#16181b'
  ctx.fillRect(-126 + back, -44, 6, 6)
  ctx.fillRect(4 + back, -44, 10, 6)
  if (pose.slide > 0.2) {
    ctx.fillStyle = '#c8a24a'
    ctx.fillRect(-46, -34, 10, 5)
  }
  rightArm(ctx, 2, 12)
  if (pose.flash) burstFlash(ctx, -142, -25, 44)
}

function shotgun(ctx: Ctx, pose: ViewModelPose) {
  const pump = pose.slide * 44
  polygon(ctx, wood(ctx, -34, 40), [14, -34, 170, -26, 180, 36, 24, 14])
  polygon(ctx, steel(ctx, -40, -2, ['#4a4f57', '#2a2d33', '#16181b']), [-120, -40, 18, -40, 18, -4, -120, -4])
  ctx.fillStyle = '#0d0e10'
  ctx.fillRect(-84, -30, 34, 12)
  polygon(ctx, steel(ctx, -38, -22, ['#a0a8b2', '#4b5159', '#22252a']), [-322, -36, -118, -36, -118, -22, -322, -22])
  polygon(ctx, steel(ctx, -22, -10, ['#6c737c', '#30343a', '#1a1c20']), [-300, -22, -118, -22, -118, -10, -300, -10])
  ctx.fillStyle = '#d7dadf'
  ctx.fillRect(-318, -41, 4, 5)
  polygon(ctx, wood(ctx, -28, -2), [-262 + pump, -28, -164 + pump, -28, -160 + pump, -2, -266 + pump, -2])
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  for (let i = 0; i < 6; i++) ctx.fillRect(-250 + pump + i * 14, -26, 4, 22)
  polygon(ctx, wood(ctx, -4, 50), [-16, -4, 16, -4, 34, 44, 4, 50])
  leftArm(ctx, -212 + pump, 4)
  rightArm(ctx, 2, 14)
  if (pose.flash) burstFlash(ctx, -334, -29, 70)
}

function rifle(ctx: Ctx, pose: ViewModelPose) {
  polygon(ctx, '#1e2024', [16, -36, 170, -30, 176, 26, 30, 8])
  polygon(ctx, '#2b2e33', [150, -30, 176, -30, 176, 26, 156, 22])
  ctx.save()
  ctx.globalAlpha = 1 - pose.mag * 0.9
  ctx.translate(pose.mag * -10, pose.mag * 160)
  ctx.rotate(pose.mag * 0.3)
  polygon(ctx, steel(ctx, -6, 70, ['#34383e', '#1b1d21']), [-128, -6, -90, -6, -80, 30, -96, 72, -132, 64, -118, 28])
  polygon(ctx, '#ff7a18', [-122, 40, -114, 42, -122, 62, -128, 60])
  ctx.restore()
  polygon(ctx, steel(ctx, -44, -4, ['#555c65', '#2a2e34', '#16181b']), [-160, -42, 20, -42, 20, -4, -160, -4])
  ctx.fillStyle = '#0d0e10'
  ctx.fillRect(-100, -34, 50, 12)
  ctx.fillStyle = '#3a3f46'
  ctx.fillRect(-60 + pose.slide * 16, -32, 14, 8)
  ctx.fillStyle = '#16181b'
  for (let i = 0; i < 9; i++) ctx.fillRect(-150 + i * 18, -50, 10, 8)
  ctx.fillRect(-152, -58, 12, 16)
  ctx.fillRect(4, -58, 14, 16)
  polygon(ctx, steel(ctx, -40, -8, ['#40454c', '#1e2125', '#121315']), [-268, -40, -158, -40, -158, -8, -262, -12])
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  for (let i = 0; i < 5; i++) ctx.fillRect(-256 + i * 20, -34, 12, 5)
  polygon(ctx, steel(ctx, -30, -18, ['#6c737c', '#2a2d32']), [-322, -30, -266, -30, -266, -18, -322, -18])
  ctx.fillStyle = '#16181b'
  ctx.fillRect(-300, -46, 8, 16)
  ctx.fillRect(-336, -32, 16, 16)
  polygon(ctx, '#1b1d21', [-34, -4, -6, -4, 8, 46, -20, 50])
  leftArm(ctx, -218, 2)
  rightArm(ctx, -12, 16)
  if (pose.flash) burstFlash(ctx, -344, -24, 48)
}

function sniper(ctx: Ctx, pose: ViewModelPose) {
  const bolt = pose.slide * 30
  polygon(ctx, wood(ctx, -40, 44), [10, -30, 70, -44, 190, -34, 196, 36, 30, 16])
  polygon(ctx, '#2f1a0b', [70, -44, 160, -40, 150, -30, 80, -32])
  polygon(ctx, wood(ctx, -20, 40), [-300, -22, 12, -22, 20, 20, -40, 10, -290, 2])
  ctx.save()
  ctx.globalAlpha = 1 - pose.mag * 0.9
  ctx.translate(0, pose.mag * 140)
  polygon(ctx, '#1c1e22', [-104, 4, -64, 4, -66, 34, -102, 34])
  ctx.restore()
  polygon(ctx, steel(ctx, -44, -18, ['#5b626b', '#2a2e34', '#16181b']), [-140, -44, 10, -44, 10, -18, -140, -18])
  ctx.strokeStyle = '#2a2e34'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(-6 + bolt, -34)
  ctx.lineTo(8 + bolt, -8)
  ctx.stroke()
  oval(ctx, 9 + bolt, -6, 7, 7, '#3a3f46')
  polygon(ctx, steel(ctx, -38, -24, ['#8c949e', '#3b4047', '#1a1c20']), [-440, -36, -140, -38, -140, -24, -440, -26])
  ctx.fillStyle = '#16181b'
  ctx.fillRect(-458, -40, 22, 18)
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  for (let i = 0; i < 4; i++) ctx.fillRect(-454 + i * 5, -38, 2, 14)
  ctx.fillStyle = '#16181b'
  ctx.fillRect(-116, -58, 12, 16)
  ctx.fillRect(-34, -58, 12, 16)
  polygon(ctx, steel(ctx, -86, -52, ['#4b525b', '#23262b', '#0f1012']), [-150, -80, -120, -72, -20, -72, 6, -78, 6, -52, -20, -58, -120, -58, -150, -50])
  oval(ctx, -76, -86, 8, 7, '#2a2d32')
  oval(ctx, -150, -65, 5, 15, '#5ab8ff')
  oval(ctx, -148, -65, 3, 11, '#0f2233')
  polygon(ctx, '#1b1d21', [-24, -18, 4, -18, 18, 40, -10, 46])
  leftArm(ctx, -236, 8)
  rightArm(ctx, -4, 16)
  if (pose.flash) burstFlash(ctx, -470, -31, 64)
}

const PAINTERS: Record<WeaponId, (ctx: Ctx, pose: ViewModelPose) => void> = { pistol, shotgun, rifle, sniper }

export function drawViewModel(ctx: Ctx, weapon: WeaponId, pose: ViewModelPose) {
  PAINTERS[weapon](ctx, pose)
}
