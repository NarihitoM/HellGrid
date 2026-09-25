import type { GameResult, HudState, Phase } from '../types/types.ts'
import { Sfx } from './audio.ts'
import { Input } from './input.ts'
import { Renderer } from './renderer.ts'
import { MAX_SQUAD, World } from './world.ts'

export interface EngineEvents {
  onHud: (hud: HudState) => void
  onPhase: (phase: Phase) => void
  onResult: (result: GameResult) => void
}

const INTERNAL_WIDTH = 640
const DEATH_DELAY = 1.8
const BEST_KEY = 'hellgrid.best'
const SENSITIVITY_KEY = 'hellgrid.sensitivity'
const SQUAD_KEY = 'hellgrid.squad'

export function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    const value = Number(raw)
    return raw !== null && Number.isFinite(value) && value >= 0 ? value : fallback
  } catch {
    return fallback
  }
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    return
  }
}

export const loadBest = () => loadNumber(BEST_KEY, 0)
export const loadSensitivity = () => loadNumber(SENSITIVITY_KEY, 1) || 1
export const loadSquad = () => Math.min(MAX_SQUAD, Math.floor(loadNumber(SQUAD_KEY, 0)))

function sameHud(a: HudState | null, b: HudState): boolean {
  if (!a) return false
  return (Object.keys(b) as (keyof HudState)[]).every((key) => a[key] === b[key])
}

export class Engine {
  private readonly canvas: HTMLCanvasElement
  private readonly events: EngineEvents
  private readonly sfx = new Sfx()
  private readonly input: Input
  private readonly renderer: Renderer
  private readonly world: World
  private phase: Phase = 'menu'
  private sensitivity = loadSensitivity()
  private frame = 0
  private lastTime = 0
  private lastHud: HudState | null = null

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas
    this.events = events
    this.input = new Input(canvas)
    this.renderer = new Renderer(canvas)
    this.world = new World(this.sfx)
    this.world.squad = loadSquad()

    this.resize()
    window.addEventListener('resize', this.resize)
    document.addEventListener('pointerlockchange', this.onLockChange)
    this.frame = requestAnimationFrame(this.loop)
  }

  start() {
    this.world.reset()
    this.lastHud = null
    this.resume()
  }

  resume() {
    this.sfx.unlock()
    this.input.reset()
    Promise.resolve(this.canvas.requestPointerLock()).catch(() => undefined)
  }

  quit() {
    this.world.reset()
    this.setPhase('menu')
  }

  setSensitivity(value: number) {
    this.sensitivity = value
    saveNumber(SENSITIVITY_KEY, value)
  }

  setSquad(value: number) {
    this.world.squad = value
    saveNumber(SQUAD_KEY, value)
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    window.removeEventListener('resize', this.resize)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    this.input.destroy()
    this.sfx.destroy()
  }

  private setPhase(phase: Phase) {
    if (this.phase === phase) return
    this.phase = phase
    this.events.onPhase(phase)
  }

  private resize = () => {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    const height = Math.round(Math.min(520, Math.max(240, INTERNAL_WIDTH / aspect)))
    this.renderer.resize(INTERNAL_WIDTH, height)
  }

  private onLockChange = () => {
    const locked = document.pointerLockElement === this.canvas
    if (locked && this.phase !== 'playing') this.setPhase('playing')
    else if (!locked && this.phase === 'playing') {
      this.input.reset()
      this.setPhase('paused')
    }
  }

  private loop = (time: number) => {
    this.frame = requestAnimationFrame(this.loop)
    const dt = this.lastTime ? Math.min(0.05, (time - this.lastTime) / 1000) : 0
    this.lastTime = time

    if (this.phase === 'playing') {
      this.world.update(dt, this.input.read(this.sensitivity, dt))
      if (this.world.player.deathTime > DEATH_DELAY) this.gameOver()
    } else if (this.phase === 'menu') {
      this.world.idle(dt)
    }

    this.renderer.render(this.world)

    const hud = this.world.hud()
    if (!sameHud(this.lastHud, hud)) {
      this.lastHud = hud
      this.events.onHud(hud)
    }
  }

  private gameOver() {
    const previous = loadBest()
    const { score, wave, kills } = this.world
    const best = Math.max(previous, score)
    if (score > previous) saveNumber(BEST_KEY, score)

    this.setPhase('dead')
    this.events.onResult({ score, wave, kills, best, record: score > previous })
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }
}
