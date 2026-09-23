import type { AmmoType, WeaponId } from '../types/types.ts'
import type { SoundName } from './audio.ts'

export interface WeaponSpec {
  name: string
  slot: number
  ammo: AmmoType
  magSize: number
  reloadTime: number
  cooldown: number
  pellets: number
  spread: number
  aimSpread: number
  damage: [number, number]
  zoom: readonly number[]
  pierce: number
  sound: SoundName
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  pistol: {
    name: 'Pistol',
    slot: 1,
    ammo: 'bullets',
    magSize: 12,
    reloadTime: 1.2,
    cooldown: 0.3,
    pellets: 1,
    spread: 0.014,
    aimSpread: 0.004,
    damage: [16, 24],
    zoom: [1.35],
    pierce: 1,
    sound: 'pistol',
  },
  shotgun: {
    name: 'Shotgun',
    slot: 2,
    ammo: 'shells',
    magSize: 6,
    reloadTime: 1.7,
    cooldown: 0.85,
    pellets: 9,
    spread: 0.1,
    aimSpread: 0.07,
    damage: [9, 14],
    zoom: [1.25],
    pierce: 1,
    sound: 'shotgun',
  },
  rifle: {
    name: 'Rifle',
    slot: 3,
    ammo: 'bullets',
    magSize: 30,
    reloadTime: 1.9,
    cooldown: 0.09,
    pellets: 1,
    spread: 0.034,
    aimSpread: 0.01,
    damage: [12, 16],
    zoom: [1.6],
    pierce: 1,
    sound: 'rifle',
  },
  sniper: {
    name: 'Sniper',
    slot: 4,
    ammo: 'bullets',
    magSize: 5,
    reloadTime: 2.4,
    cooldown: 1.3,
    pellets: 1,
    spread: 0.12,
    aimSpread: 0,
    damage: [110, 150],
    zoom: [2.5, 5],
    pierce: 3,
    sound: 'sniper',
  },
}

export const WEAPON_ORDER: readonly WeaponId[] = ['pistol', 'shotgun', 'rifle', 'sniper']
