import type {
  Ally,
  AmmoType,
  Enemy,
  EnemyKind,
  HudState,
  Particle,
  ParticleKind,
  Pickup,
  PickupKind,
  Player,
  Point,
  Projectile,
  SquadMember,
  WeaponId,
} from '../types/types.ts'
import type { Sfx } from './audio.ts'
import type { InputFrame } from './input.ts'
import { isSolid, pickupSpots, playerStart, spawnPoints } from './map.ts'
import { castRay, createRayHit, FlowField, hasLineOfSight } from './nav.ts'
import { WEAPON_ORDER, WEAPONS } from './weapons.ts'

interface EnemyStats {
  hp: number
  speed: number
  radius: number
  size: number
  score: number
  range: number
  windup: number
  damage: [number, number]
  cooldown: number
  ranged: boolean
  painChance: number
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  grunt: {
    hp: 40,
    speed: 2.5,
    radius: 0.28,
    size: 0.8,
    score: 100,
    range: 0.9,
    windup: 0.35,
    damage: [8, 13],
    cooldown: 0.9,
    ranged: false,
    painChance: 0.55,
  },
  gunner: {
    hp: 60,
    speed: 1.7,
    radius: 0.3,
    size: 0.95,
    score: 150,
    range: 12,
    windup: 0.45,
    damage: [9, 15],
    cooldown: 1.8,
    ranged: true,
    painChance: 0.4,
  },
  brute: {
    hp: 260,
    speed: 1.55,
    radius: 0.4,
    size: 1.25,
    score: 400,
    range: 1.2,
    windup: 0.55,
    damage: [22, 32],
    cooldown: 1.3,
    ranged: false,
    painChance: 0.15,
  },
}

export const PLAYER_RADIUS = 0.22
const MAX_HEALTH = 100
const WALK_SPEED = 3.5
const SPRINT_SPEED = 5.4
export const SWITCH_TIME = 0.3
const AMMO_MAX: Record<AmmoType, number> = { bullets: 200, shells: 50 }
const PICKUP_AMOUNT: Record<PickupKind, number> = { health: 25, bullets: 30, shells: 8 }
const UNLOCKS: Partial<Record<number, { weapon: WeaponId; ammo: AmmoType; amount: number }>> = {
  2: { weapon: 'shotgun', ammo: 'shells', amount: 12 },
  3: { weapon: 'rifle', ammo: 'bullets', amount: 80 },
  4: { weapon: 'sniper', ammo: 'bullets', amount: 20 },
}
export const INSPECT_TIME = 2.4
export const MAX_SQUAD = 3
const ALLY_NAMES = ['Alpha', 'Bravo', 'Charlie']
const ALLY_HP = 120
const ALLY_ARMOR = 0.6
const ALLY_SPEED = 3.4
const ALLY_RANGE = 15
const ALLY_AGGRO = 8
const ALLY_LEASH = 6
const ALLY_REACTION = 0.35
const ALLY_SPREAD = 0.05
const ALLY_DAMAGE: [number, number] = [9, 13]
const SPOT_OFFSETS = [0.5, -0.5, 1.2, -1.2, 0, 1.9, -1.9, 2.6, -2.6]

const rand = (min: number, max: number) => min + Math.random() * (max - min)
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function collides(x: number, y: number, r: number): boolean {
  return isSolid(x - r, y - r) || isSolid(x + r, y - r) || isSolid(x - r, y + r) || isSolid(x + r, y + r)
}

function slide(body: Point, dx: number, dy: number, r: number) {
  if (!collides(body.x + dx, body.y, r)) body.x += dx
  if (!collides(body.x, body.y + dy, r)) body.y += dy
}

function createPlayer(): Player {
  return {
    x: playerStart.x,
    y: playerStart.y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    pitch: 0,
    health: MAX_HEALTH,
    ammo: { bullets: 48, shells: 0 },
    weapon: 'pistol',
    owned: ['pistol'],
    mag: { pistol: WEAPONS.pistol.magSize, shotgun: 0, rifle: 0, sniper: 0 },
    cooldown: 0,
    switching: 0,
    reloading: 0,
    inspecting: 0,
    aim: 0,
    scope: 0,
    zoom: 1,
    swayX: 0,
    swayY: 0,
    lean: 0,
    sprint: 0,
    bob: 0,
    moving: 0,
    kick: 0,
    muzzle: 0,
    hurt: 0,
    glow: 0,
    deathTime: 0,
  }
}

export class World {
  player = createPlayer()
  enemies: Enemy[] = []
  projectiles: Projectile[] = []
  particles: Particle[] = []
  pickups: Pickup[] = []
  allies: Ally[] = []
  squad = 0
  wave = 0
  score = 0
  kills = 0
  time = 0
  banner = ''
  bannerId = 0

  private readonly sfx: Sfx
  private readonly flow = new FlowField()
  private readonly hit = createRayHit()
  private readonly waypoint: Point = { x: 0, y: 0 }
  private spawnQueue: EnemyKind[] = []
  private spawnTimer = 0
  private waveTimer = 0
  private squadHud: SquadMember[] = []
  private squadKey = ''

  constructor(sfx: Sfx) {
    this.sfx = sfx
    this.reset()
  }

  reset() {
    this.player = createPlayer()
    this.enemies = []
    this.projectiles = []
    this.particles = []
    this.pickups = pickupSpots.map((spot) => ({ ...spot, active: true, dropped: false }))
    this.wave = 0
    this.score = 0
    this.kills = 0
    this.time = 0
    this.spawnQueue = []
    this.spawnTimer = 0
    this.waveTimer = 2.5
    this.squadKey = '-'
    this.spawnAllies()
    this.announce('Get ready')
  }

  idle(dt: number) {
    this.time += dt
    this.player.angle += dt * 0.12
  }

  update(dt: number, input: InputFrame) {
    this.time += dt
    const p = this.player

    if (p.health > 0) this.updatePlayer(dt, input)
    else p.deathTime += dt

    p.hurt = Math.max(0, p.hurt - dt * 1.6)
    p.glow = Math.max(0, p.glow - dt * 2.5)
    p.muzzle = Math.max(0, p.muzzle - dt)
    p.kick = Math.max(0, p.kick - dt * 7)

    this.flow.update(p.x, p.y)
    this.updateEnemies(dt)
    this.updateAllies(dt)
    this.updateProjectiles(dt)
    this.updateParticles(dt)
    this.updateWaves(dt)
  }

  hud(): HudState {
    const p = this.player
    const key = this.allies.map((a) => Math.ceil((a.hp / ALLY_HP) * 100)).join()
    if (key !== this.squadKey) {
      this.squadKey = key
      this.squadHud = this.allies.map((a) => ({ name: a.name, health: Math.ceil((a.hp / ALLY_HP) * 100) }))
    }
    return {
      health: Math.ceil(p.health),
      mag: p.mag[p.weapon],
      reserve: p.ammo[WEAPONS[p.weapon].ammo],
      reloading: p.reloading > 0,
      scoped: this.scoped,
      bullets: p.ammo.bullets,
      shells: p.ammo.shells,
      weapon: p.weapon,
      owned: p.owned,
      squad: this.squadHud,
      score: this.score,
      wave: this.wave,
      enemiesLeft: this.spawnQueue.length + this.enemies.filter((e) => e.state !== 'dead').length,
      banner: this.banner,
      bannerId: this.bannerId,
    }
  }

  get scoped(): boolean {
    return this.player.weapon === 'sniper' && this.player.scope > 0 && this.player.aim > 0.85
  }

  private announce(text: string) {
    this.banner = text
    this.bannerId++
  }

  private volumeAt(point: Point): number {
    return clamp(1 - Math.hypot(point.x - this.player.x, point.y - this.player.y) / 22, 0.08, 1)
  }

  private updatePlayer(dt: number, input: InputFrame) {
    const p = this.player
    p.angle += input.turn / p.zoom
    p.pitch = clamp(p.pitch - input.look / p.zoom, -0.6, 0.6)

    const settle = Math.exp(-dt * 9)
    p.swayX = clamp(p.swayX * settle + input.turn, -0.35, 0.35)
    p.swayY = clamp(p.swayY * settle + input.look, -0.35, 0.35)

    let forward = input.forward
    let strafe = input.strafe
    const length = Math.hypot(forward, strafe)
    if (length > 1) {
      forward /= length
      strafe /= length
    }

    const sprinting = input.sprint && forward > 0 && !input.aim && p.scope === 0
    const blend = Math.min(1, dt * 8)
    p.sprint += ((sprinting ? 1 : 0) - p.sprint) * blend
    p.lean += (strafe - p.lean) * blend

    const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * (1 - p.aim * 0.4)
    const cos = Math.cos(p.angle)
    const sin = Math.sin(p.angle)
    const accel = Math.min(1, dt * 10)
    p.vx += ((cos * forward - sin * strafe) * speed - p.vx) * accel
    p.vy += ((sin * forward + cos * strafe) * speed - p.vy) * accel

    slide(p, p.vx * dt, p.vy * dt, PLAYER_RADIUS)
    this.pushOutOfEnemies()

    p.moving = Math.min(1.5, Math.hypot(p.vx, p.vy) / WALK_SPEED)
    p.bob += dt * p.moving * 9

    this.switchWeapon(input)
    p.cooldown -= dt
    p.switching = Math.max(0, p.switching - dt)

    if (p.reloading > 0) {
      p.reloading -= dt
      if (p.reloading <= 0) this.finishReload()
    }
    if (input.reload) this.startReload()
    if (input.inspect && p.reloading <= 0 && p.switching <= 0 && p.scope === 0) p.inspecting = INSPECT_TIME
    p.inspecting = Math.max(0, p.inspecting - dt)

    this.updateAim(dt, input)
    if (input.fire && p.cooldown <= 0 && p.switching <= 0 && p.reloading <= 0) this.fire()

    this.collectPickups()
  }

  private updateAim(dt: number, input: InputFrame) {
    const p = this.player
    const spec = WEAPONS[p.weapon]
    const busy = p.reloading > 0 || p.switching > 0

    if (busy) p.scope = 0
    else if (spec.zoom.length > 1) {
      if (input.aimPressed) {
        p.scope = (p.scope + 1) % (spec.zoom.length + 1)
        p.inspecting = 0
        this.sfx.play('scope')
      }
    } else {
      p.scope = input.aim ? 1 : 0
      if (input.aim) p.inspecting = 0
    }

    const blend = Math.min(1, dt * 14)
    p.aim += ((p.scope > 0 ? 1 : 0) - p.aim) * blend
    p.zoom += ((p.scope > 0 ? spec.zoom[p.scope - 1] : 1) - p.zoom) * blend
  }

  private startReload() {
    const p = this.player
    const spec = WEAPONS[p.weapon]
    if (p.reloading > 0 || p.switching > 0 || p.mag[p.weapon] >= spec.magSize || p.ammo[spec.ammo] <= 0) return
    p.reloading = spec.reloadTime
    p.inspecting = 0
    this.sfx.play('reload')
  }

  private finishReload() {
    const p = this.player
    const spec = WEAPONS[p.weapon]
    const taken = Math.min(spec.magSize - p.mag[p.weapon], p.ammo[spec.ammo])
    p.mag[p.weapon] += taken
    p.ammo[spec.ammo] -= taken
    p.reloading = 0
  }

  private pushOutOfEnemies() {
    const p = this.player
    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const dx = p.x - e.x
      const dy = p.y - e.y
      const dist = Math.hypot(dx, dy)
      const min = PLAYER_RADIUS + ENEMY_STATS[e.kind].radius
      if (dist >= min || dist < 1e-4) continue
      slide(p, (dx / dist) * (min - dist), (dy / dist) * (min - dist), PLAYER_RADIUS)
    }
  }

  private switchWeapon(input: InputFrame) {
    const p = this.player
    let target: WeaponId | undefined

    if (input.slot !== null) target = WEAPON_ORDER[input.slot - 1]
    if (input.cycle !== 0) {
      const owned = WEAPON_ORDER.filter((id) => p.owned.includes(id))
      const index = owned.indexOf(p.weapon)
      target = owned[(index + input.cycle + owned.length) % owned.length]
    }

    if (target && target !== p.weapon && p.owned.includes(target)) this.equip(target)
  }

  private equip(weapon: WeaponId) {
    const p = this.player
    p.weapon = weapon
    p.switching = SWITCH_TIME
    p.reloading = 0
    p.inspecting = 0
    p.scope = 0
  }

  private fire() {
    const p = this.player
    const spec = WEAPONS[p.weapon]

    if (p.mag[p.weapon] <= 0) {
      if (p.ammo[spec.ammo] > 0) {
        this.startReload()
        return
      }
      this.sfx.play('empty')
      p.cooldown = 0.35
      const fallback = [...p.owned].reverse().find((id) => p.mag[id] > 0 || p.ammo[WEAPONS[id].ammo] > 0)
      if (fallback && fallback !== p.weapon) this.equip(fallback)
      return
    }

    p.mag[p.weapon] -= 1
    p.cooldown = spec.cooldown
    p.muzzle = 0.07
    p.kick = 1
    p.inspecting = 0
    this.sfx.play(spec.sound)

    const spread = spec.spread + (spec.aimSpread - spec.spread) * p.aim + Math.min(1, p.moving) * 0.012
    const damage = new Map<Enemy, number>()
    for (let i = 0; i < spec.pellets; i++) {
      this.trace(p, p.angle + rand(-spread, spread), spec.pierce, spec.damage, p.pitch, damage)
    }
    for (const [enemy, amount] of damage) this.damageEnemy(enemy, amount)
  }

  private trace(
    origin: Point,
    angle: number,
    pierce: number,
    range: [number, number],
    pitch: number,
    damage: Map<Enemy, number>,
  ) {
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const wall = castRay(origin.x, origin.y, dx, dy, this.hit).dist
    const hits: { enemy: Enemy; along: number }[] = []

    for (const e of this.enemies) {
      if (e.state === 'dead') continue
      const ex = e.x - origin.x
      const ey = e.y - origin.y
      const along = ex * dx + ey * dy
      if (along <= 0 || along >= wall) continue
      if (Math.abs(ex * dy - ey * dx) < ENEMY_STATS[e.kind].radius * 1.15) hits.push({ enemy: e, along })
    }
    hits.sort((a, b) => a.along - b.along)

    const pierced = hits.slice(0, pierce)
    pierced.forEach(({ enemy, along }, order) => {
      const amount = rand(...range) * 0.7 ** order
      damage.set(enemy, (damage.get(enemy) ?? 0) + amount)
      this.burst(origin.x + dx * along, origin.y + dy * along, ENEMY_STATS[enemy.kind].size * 0.6, 'blood', 4)
    })

    if (pierced.length < pierce) {
      const z = clamp(0.5 + pitch * 0.43 * wall, 0.05, 0.95)
      this.burst(origin.x + dx * (wall - 0.04), origin.y + dy * (wall - 0.04), z, 'spark', 3)
    }
  }

  private damageEnemy(e: Enemy, amount: number) {
    const stats = ENEMY_STATS[e.kind]
    e.hp -= amount
    e.flash = 0.1

    if (e.hp <= 0) {
      e.state = 'dead'
      e.timer = 0
      this.kills++
      this.score += stats.score
      this.sfx.play(e.kind === 'brute' ? 'bruteDie' : 'enemyDie', this.volumeAt(e))
      this.burst(e.x, e.y, stats.size * 0.5, 'blood', 12)
      this.dropLoot(e)
      return
    }

    this.sfx.play('enemyHurt', this.volumeAt(e) * 0.8)
    if (e.state !== 'attack' && Math.random() < stats.painChance) {
      e.state = 'pain'
      e.timer = 0.2
    }
  }

  private dropLoot(e: Enemy) {
    const roll = Math.random()
    let kind: PickupKind | null = null
    if (e.kind === 'brute') kind = 'shells'
    else if (e.kind === 'gunner' && roll < 0.45) kind = 'bullets'
    else if (e.kind === 'grunt' && roll < 0.12) kind = 'health'
    if (kind) this.pickups.push({ x: e.x, y: e.y, kind, active: true, dropped: true })
  }

  private collectPickups() {
    const p = this.player
    for (const pickup of this.pickups) {
      if (!pickup.active || Math.hypot(pickup.x - p.x, pickup.y - p.y) > 0.55) continue

      if (pickup.kind === 'health') {
        if (p.health >= MAX_HEALTH) continue
        p.health = Math.min(MAX_HEALTH, p.health + PICKUP_AMOUNT.health)
      } else {
        const max = AMMO_MAX[pickup.kind]
        if (p.ammo[pickup.kind] >= max) continue
        p.ammo[pickup.kind] = Math.min(max, p.ammo[pickup.kind] + PICKUP_AMOUNT[pickup.kind])
      }

      pickup.active = false
      p.glow = 1
      this.sfx.play('pickup')
    }
    this.pickups = this.pickups.filter((pickup) => pickup.active || !pickup.dropped)
  }

  private damagePlayer(amount: number) {
    const p = this.player
    p.health = Math.max(0, p.health - Math.round(amount))
    p.hurt = Math.min(1, p.hurt + amount / 25 + 0.3)
    this.sfx.play('playerHurt')
  }

  private damageAlly(a: Ally, amount: number) {
    a.hp = Math.max(0, a.hp - amount * ALLY_ARMOR)
    a.flash = 0.15
    if (a.hp > 0) return
    a.target = null
    a.walk = 0
    this.burst(a.x, a.y, 0.4, 'blood', 10)
    this.sfx.play('playerHurt', this.volumeAt(a) * 0.6)
    this.announce(`${a.name} is down`)
  }

  private updateAllies(dt: number) {
    const p = this.player

    this.allies.forEach((a, index) => {
      a.flash = Math.max(0, a.flash - dt)
      a.muzzle = Math.max(0, a.muzzle - dt)
      if (a.hp <= 0) return

      a.cooldown -= dt
      a.think -= dt
      if (a.target?.state === 'dead') a.target = null
      if (a.think <= 0) {
        a.think = 0.3
        const previous = a.target
        a.target = this.findTarget(a)
        if (a.target && a.target !== previous) a.cooldown = Math.max(a.cooldown, ALLY_REACTION)
      }

      const px = p.x - a.x
      const py = p.y - a.y
      const toPlayer = Math.hypot(px, py)
      const leash = a.target ? ALLY_LEASH : 2 + index * 0.6
      let mx = 0
      let my = 0

      if (p.health > 0 && toPlayer > leash) {
        if (toPlayer < 10 && hasLineOfSight(a.x, a.y, p.x, p.y)) {
          mx = px / toPlayer
          my = py / toPlayer
        } else if (this.flow.next(a.x, a.y, this.waypoint)) {
          const wx = this.waypoint.x - a.x
          const wy = this.waypoint.y - a.y
          const wl = Math.hypot(wx, wy) || 1
          mx = wx / wl
          my = wy / wl
        }
      }

      const push = (x: number, y: number, min: number) => {
        const ox = a.x - x
        const oy = a.y - y
        const d = Math.hypot(ox, oy)
        if (d < min && d > 1e-4) {
          mx += (ox / d) * 0.9
          my += (oy / d) * 0.9
        }
      }
      push(p.x, p.y, 1.2)
      for (const other of this.allies) if (other !== a && other.hp > 0) push(other.x, other.y, 0.7)

      const rightX = -Math.sin(p.angle)
      const rightY = Math.cos(p.angle)
      const ahead = -px * Math.cos(p.angle) - py * Math.sin(p.angle)
      const side = -px * rightX - py * rightY
      if (ahead > 0 && ahead < 5 && Math.abs(side) < 0.9) {
        const away = side >= 0 ? 1 : -1
        mx += rightX * away * 1.2
        my += rightY * away * 1.2
      }
      for (const e of this.enemies) if (e.state !== 'dead') push(e.x, e.y, ENEMY_STATS[e.kind].radius + PLAYER_RADIUS)

      const length = Math.hypot(mx, my)
      if (length > 0.01) {
        const speed = toPlayer > 5 ? ALLY_SPEED * 1.35 : ALLY_SPEED
        const step = (speed * dt) / Math.max(1, length)
        const bx = a.x
        const by = a.y
        slide(a, mx * step, my * step, PLAYER_RADIUS)
        a.walk += Math.hypot(a.x - bx, a.y - by) * 2.5
      }

      if (a.target && a.cooldown <= 0) this.allyFire(a, a.target)
    })
  }

  private findTarget(a: Ally): Enemy | null {
    const nearby = this.enemies
      .filter((e) => e.state !== 'dead' && Math.hypot(e.x - a.x, e.y - a.y) < ALLY_RANGE)
      .sort((m, n) => Math.hypot(m.x - a.x, m.y - a.y) - Math.hypot(n.x - a.x, n.y - a.y))
    return nearby.slice(0, 4).find((e) => hasLineOfSight(a.x, a.y, e.x, e.y)) ?? null
  }

  private allyFire(a: Ally, target: Enemy) {
    a.cooldown = rand(0.3, 0.55)
    a.muzzle = 0.08
    const angle = Math.atan2(target.y - a.y, target.x - a.x) + rand(-ALLY_SPREAD, ALLY_SPREAD)
    const damage = new Map<Enemy, number>()
    this.trace(a, angle, 1, ALLY_DAMAGE, 0, damage)
    for (const [enemy, amount] of damage) this.damageEnemy(enemy, amount)
    this.sfx.play('rifle', this.volumeAt(a) * 0.45)
  }

  private spawnAllies() {
    this.allies = []
    ALLY_NAMES.slice(0, this.squad).forEach((name) => {
      this.allies.push({
        ...this.spotNear(this.player),
        name,
        hp: ALLY_HP,
        cooldown: 0,
        think: 0,
        walk: 0,
        flash: 0,
        muzzle: 0,
        target: null,
      })
    })
  }

  private spotNear(center: Point): Point {
    for (let ring = 1; ring <= 3; ring++) {
      for (const offset of SPOT_OFFSETS) {
        const angle = this.player.angle + Math.PI + offset
        const x = center.x + Math.cos(angle) * (0.6 + ring * 0.8)
        const y = center.y + Math.sin(angle) * (0.6 + ring * 0.8)
        const taken = this.allies.some((a) => Math.hypot(a.x - x, a.y - y) < 0.6)
        if (!collides(x, y, PLAYER_RADIUS) && !taken && hasLineOfSight(center.x, center.y, x, y)) return { x, y }
      }
    }
    return { x: center.x, y: center.y }
  }

  private updateEnemies(dt: number) {
    const p = this.player
    const alive = p.health > 0
    const pace = 1 + Math.min(0.35, (this.wave - 1) * 0.04)

    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt)
      if (e.state === 'dead') {
        e.timer += dt
        continue
      }

      const stats = ENEMY_STATS[e.kind]
      e.cooldown -= dt

      if (e.state === 'attack') {
        e.timer -= dt
        if (e.timer <= 0) {
          this.resolveAttack(e)
          e.state = 'chase'
          e.cooldown = stats.cooldown * rand(0.8, 1.3)
        }
        continue
      }

      if (e.state === 'pain') {
        e.timer -= dt
        if (e.timer <= 0) e.state = 'chase'
        continue
      }

      e.target = this.pickTarget(e)
      const goal: Point = e.target ?? p
      const dx = goal.x - e.x
      const dy = goal.y - e.y
      const dist = Math.hypot(dx, dy)
      const sees = (e.target !== null || alive) && dist < 18 && hasLineOfSight(e.x, e.y, goal.x, goal.y)
      if (sees && e.cooldown <= 0 && dist <= stats.range) {
        e.state = 'attack'
        e.timer = stats.windup
        continue
      }

      let mx = 0
      let my = 0
      if (sees && stats.ranged && dist < 7) {
        e.strafeTime -= dt
        if (e.strafeTime <= 0) {
          e.strafe = Math.random() < 0.5 ? -1 : 1
          e.strafeTime = rand(0.8, 2)
        }
        const retreat = dist < 3.5 ? -0.7 : 0
        mx = (-dy * e.strafe + dx * retreat) / dist
        my = (dx * e.strafe + dy * retreat) / dist
      } else if (sees) {
        if (dist > stats.radius + PLAYER_RADIUS + 0.15) {
          mx = dx / dist
          my = dy / dist
        }
      } else if (alive && this.flow.next(e.x, e.y, this.waypoint)) {
        const wx = this.waypoint.x - e.x
        const wy = this.waypoint.y - e.y
        const wl = Math.hypot(wx, wy) || 1
        mx = wx / wl
        my = wy / wl
      }

      for (const other of this.enemies) {
        if (other === e || other.state === 'dead') continue
        const ox = e.x - other.x
        const oy = e.y - other.y
        const d = Math.hypot(ox, oy)
        const min = stats.radius + ENEMY_STATS[other.kind].radius
        if (d < min && d > 1e-4) {
          mx += (ox / d) * 0.9
          my += (oy / d) * 0.9
        }
      }

      const length = Math.hypot(mx, my)
      if (length < 0.01) continue

      const step = (stats.speed * pace * dt) / Math.max(1, length)
      const bx = e.x
      const by = e.y
      slide(e, mx * step, my * step, stats.radius)
      if (Math.hypot(p.x - e.x, p.y - e.y) < stats.radius + PLAYER_RADIUS) {
        e.x = bx
        e.y = by
      }
      e.walk += Math.hypot(e.x - bx, e.y - by) * 2.5
    }
  }

  private pickTarget(e: Enemy): Ally | null {
    const p = this.player
    let best: Ally | null = null
    let bestDist = p.health > 0 ? Math.hypot(p.x - e.x, p.y - e.y) : Infinity

    for (const a of this.allies) {
      if (a.hp <= 0) continue
      const d = Math.hypot(a.x - e.x, a.y - e.y)
      if (d < bestDist && d < ALLY_AGGRO) {
        best = a
        bestDist = d
      }
    }
    return best && hasLineOfSight(e.x, e.y, best.x, best.y) ? best : null
  }

  private resolveAttack(e: Enemy) {
    const stats = ENEMY_STATS[e.kind]
    const p = this.player
    const ally = e.target && e.target.hp > 0 ? e.target : null
    if (!ally && p.health <= 0) return
    const goal: Point = ally ?? p
    const dist = Math.hypot(goal.x - e.x, goal.y - e.y)

    if (stats.ranged) {
      const angle = Math.atan2(goal.y - e.y, goal.x - e.x) + rand(-0.06, 0.06)
      const speed = 8
      this.projectiles.push({
        x: e.x + Math.cos(angle) * 0.35,
        y: e.y + Math.sin(angle) * 0.35,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        z: 0.5,
        damage: rand(...stats.damage),
        life: 4,
      })
      this.sfx.play('fireball', this.volumeAt(e))
      return
    }

    this.sfx.play('swing', this.volumeAt(e))
    if (dist > stats.range + 0.25) return
    if (ally) this.damageAlly(ally, rand(...stats.damage))
    else this.damagePlayer(rand(...stats.damage))
  }

  private updateProjectiles(dt: number) {
    const p = this.player
    this.projectiles = this.projectiles.filter((shot) => {
      shot.x += shot.dx * dt
      shot.y += shot.dy * dt
      shot.life -= dt

      if (shot.life <= 0 || isSolid(shot.x, shot.y)) {
        this.burst(shot.x - shot.dx * dt, shot.y - shot.dy * dt, shot.z, 'ember', 6)
        return false
      }

      if (p.health > 0 && Math.hypot(p.x - shot.x, p.y - shot.y) < PLAYER_RADIUS + 0.15) {
        this.damagePlayer(shot.damage)
        this.burst(shot.x, shot.y, shot.z, 'ember', 8)
        return false
      }

      const ally = this.allies.find((a) => a.hp > 0 && Math.hypot(a.x - shot.x, a.y - shot.y) < PLAYER_RADIUS + 0.15)
      if (ally) {
        this.damageAlly(ally, shot.damage)
        this.burst(shot.x, shot.y, shot.z, 'ember', 8)
        return false
      }
      return true
    })
  }

  private burst(x: number, y: number, z: number, kind: ParticleKind, count: number) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        z,
        vx: rand(-1.2, 1.2),
        vy: rand(-1.2, 1.2),
        vz: rand(0.4, 2.2),
        life: rand(0.25, 0.6),
        kind,
      })
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400)
  }

  private updateParticles(dt: number) {
    for (const particle of this.particles) {
      particle.vz -= 7 * dt
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.z += particle.vz * dt
      if (particle.z < 0) {
        particle.z = 0
        particle.vx *= 0.4
        particle.vy *= 0.4
        particle.vz = 0
      }
      particle.life -= dt
    }
    this.particles = this.particles.filter((particle) => particle.life > 0)
  }

  private updateWaves(dt: number) {
    if (this.player.health <= 0) return

    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        const kind = this.spawnQueue.shift()
        if (kind) this.spawnEnemy(kind)
        this.spawnTimer = 0.7
      }
      return
    }

    if (this.enemies.some((e) => e.state !== 'dead')) return

    if (this.waveTimer > 0) {
      this.waveTimer -= dt
      if (this.waveTimer <= 0) this.startWave()
      return
    }

    const bonus = this.wave * 250
    this.score += bonus
    this.announce(`Wave ${this.wave} cleared  +${bonus}`)
    this.sfx.play('wave')
    this.waveTimer = 3.5
  }

  private startWave() {
    this.wave++
    const n = this.wave
    const queue: EnemyKind[] = [
      ...Array<EnemyKind>(Math.min(14, 2 + n * 2)).fill('grunt'),
      ...Array<EnemyKind>(Math.min(8, Math.max(0, n - 1))).fill('gunner'),
      ...Array<EnemyKind>(n >= 3 ? Math.min(5, Math.floor((n - 1) / 2)) : 0).fill('brute'),
    ]
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[queue[i], queue[j]] = [queue[j], queue[i]]
    }

    this.spawnQueue = queue
    this.spawnTimer = 0.6
    this.enemies = this.enemies.filter((e) => e.state !== 'dead')
    for (const pickup of this.pickups) pickup.active = true
    for (const a of this.allies) {
      if (a.hp <= 0) Object.assign(a, this.spotNear(this.player))
      a.hp = ALLY_HP
    }

    const unlock = UNLOCKS[n]
    if (unlock && !this.player.owned.includes(unlock.weapon)) {
      const p = this.player
      p.owned = [...p.owned, unlock.weapon]
      p.mag[unlock.weapon] = WEAPONS[unlock.weapon].magSize
      p.ammo[unlock.ammo] = Math.min(AMMO_MAX[unlock.ammo], p.ammo[unlock.ammo] + unlock.amount)
      this.equip(unlock.weapon)
      this.announce(`Wave ${n}  ·  ${WEAPONS[unlock.weapon].name} unlocked [${WEAPONS[unlock.weapon].slot}]`)
      this.sfx.play('unlock')
      return
    }

    this.announce(`Wave ${n}`)
    this.sfx.play('wave')
  }

  private spawnEnemy(kind: EnemyKind) {
    const p = this.player
    const stats = ENEMY_STATS[kind]
    const hidden = spawnPoints.filter(
      (s) => Math.hypot(s.x - p.x, s.y - p.y) > 7 && !hasLineOfSight(s.x, s.y, p.x, p.y),
    )
    const pool =
      hidden.length > 0
        ? hidden
        : [...spawnPoints].sort((a, b) => Math.hypot(b.x - p.x, b.y - p.y) - Math.hypot(a.x - p.x, a.y - p.y)).slice(0, 2)
    const spot = pool[Math.floor(Math.random() * pool.length)]

    let x = spot.x
    let y = spot.y
    for (let attempt = 0; attempt < 8; attempt++) {
      const jx = spot.x + rand(-0.9, 0.9)
      const jy = spot.y + rand(-0.9, 0.9)
      const crowded = this.enemies.some((e) => e.state !== 'dead' && Math.hypot(e.x - jx, e.y - jy) < 0.7)
      if (!collides(jx, jy, stats.radius) && !crowded) {
        x = jx
        y = jy
        break
      }
    }

    this.enemies.push({
      kind,
      x,
      y,
      hp: stats.hp * (1 + (this.wave - 1) * 0.06),
      state: 'chase',
      timer: 0,
      cooldown: rand(0.6, 1.6),
      walk: rand(0, 2),
      flash: 0,
      strafe: 1,
      strafeTime: 0,
      target: null,
    })
    this.burst(x, y, 0.5, 'portal', 14)
    this.sfx.play('spawn', this.volumeAt({ x, y }) * 0.8)
  }
}
