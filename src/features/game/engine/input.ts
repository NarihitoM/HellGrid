export interface InputFrame {
  forward: number
  strafe: number
  sprint: boolean
  turn: number
  look: number
  fire: boolean
  aim: boolean
  aimPressed: boolean
  reload: boolean
  inspect: boolean
  slot: number | null
  cycle: number
}

const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyR',
  'KeyF',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'ShiftLeft',
  'ShiftRight',
])

const MOUSE_TURN = 0.0022
const MOUSE_LOOK = 0.002
const KEY_TURN = 2.6

export class Input {
  private readonly target: HTMLElement
  private readonly keys = new Set<string>()
  private readonly pressed = new Set<string>()
  private dx = 0
  private dy = 0
  private wheel = 0
  private slot: number | null = null
  private firing = false
  private aiming = false
  private aimPressed = false

  constructor(target: HTMLElement) {
    this.target = target
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.reset)
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mousedown', this.onMouseDown)
    document.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('wheel', this.onWheel)
    document.addEventListener('contextmenu', this.onContextMenu)
  }

  read(sensitivity: number, dt: number): InputFrame {
    const frame: InputFrame = {
      forward: this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
      strafe: this.axis(['KeyD'], ['KeyA']),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      turn: this.dx * MOUSE_TURN * sensitivity + this.axis(['ArrowRight'], ['ArrowLeft']) * KEY_TURN * dt,
      look: this.dy * MOUSE_LOOK * sensitivity,
      fire: this.firing || this.keys.has('Space'),
      aim: this.aiming,
      aimPressed: this.aimPressed,
      reload: this.pressed.has('KeyR'),
      inspect: this.pressed.has('KeyF'),
      slot: this.slot,
      cycle: Math.sign(this.wheel),
    }
    this.dx = 0
    this.dy = 0
    this.wheel = 0
    this.slot = null
    this.aimPressed = false
    this.pressed.clear()
    return frame
  }

  reset = () => {
    this.keys.clear()
    this.pressed.clear()
    this.firing = false
    this.aiming = false
    this.aimPressed = false
    this.dx = 0
    this.dy = 0
    this.wheel = 0
    this.slot = null
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.reset)
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mousedown', this.onMouseDown)
    document.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('contextmenu', this.onContextMenu)
  }

  private get locked(): boolean {
    return document.pointerLockElement === this.target
  }

  private axis(positive: string[], negative: string[]): number {
    const pos = positive.some((key) => this.keys.has(key)) ? 1 : 0
    const neg = negative.some((key) => this.keys.has(key)) ? 1 : 0
    return pos - neg
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.locked) return
    this.keys.add(event.code)
    if (!event.repeat) this.pressed.add(event.code)
    const digit = /^Digit([1-4])$/.exec(event.code)
    if (digit) this.slot = Number(digit[1])
    if (GAME_KEYS.has(event.code)) event.preventDefault()
  }

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.locked) return
    this.dx += event.movementX
    this.dy += event.movementY
  }

  private onMouseDown = (event: MouseEvent) => {
    if (!this.locked) return
    if (event.button === 0) this.firing = true
    if (event.button === 2) {
      this.aiming = true
      this.aimPressed = true
    }
  }

  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.firing = false
    if (event.button === 2) this.aiming = false
  }

  private onWheel = (event: WheelEvent) => {
    if (this.locked) this.wheel += event.deltaY
  }

  private onContextMenu = (event: MouseEvent) => {
    if (this.locked) event.preventDefault()
  }
}
