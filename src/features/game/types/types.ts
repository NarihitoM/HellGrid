export type WeaponId = 'pistol' | 'shotgun' | 'rifle' | 'sniper'
export type AmmoType = 'bullets' | 'shells'
export type PickupKind = 'health' | AmmoType
export type EnemyKind = 'grunt' | 'gunner' | 'brute'
export type EnemyState = 'chase' | 'attack' | 'pain' | 'dead'
export type ParticleKind = 'spark' | 'blood' | 'ember' | 'portal'
export type Phase = 'menu' | 'playing' | 'paused' | 'dead'

export interface Point {
  x: number
  y: number
}

export interface Player extends Point {
  vx: number
  vy: number
  angle: number
  pitch: number
  health: number
  ammo: Record<AmmoType, number>
  weapon: WeaponId
  owned: readonly WeaponId[]
  mag: Record<WeaponId, number>
  cooldown: number
  switching: number
  reloading: number
  inspecting: number
  aim: number
  scope: number
  zoom: number
  swayX: number
  swayY: number
  lean: number
  sprint: number
  bob: number
  moving: number
  kick: number
  muzzle: number
  hurt: number
  glow: number
  deathTime: number
}

export interface Enemy extends Point {
  kind: EnemyKind
  hp: number
  state: EnemyState
  timer: number
  cooldown: number
  walk: number
  flash: number
  strafe: number
  strafeTime: number
}

export interface Projectile extends Point {
  dx: number
  dy: number
  z: number
  damage: number
  life: number
}

export interface Particle extends Point {
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  kind: ParticleKind
}

export interface Pickup extends Point {
  kind: PickupKind
  active: boolean
  dropped: boolean
}

export interface HudState {
  health: number
  mag: number
  reserve: number
  reloading: boolean
  scoped: boolean
  bullets: number
  shells: number
  weapon: WeaponId
  owned: readonly WeaponId[]
  score: number
  wave: number
  enemiesLeft: number
  banner: string
  bannerId: number
}

export interface GameResult {
  score: number
  wave: number
  kills: number
  best: number
  record: boolean
}
