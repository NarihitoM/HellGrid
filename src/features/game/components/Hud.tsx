import { WEAPON_ORDER, WEAPONS } from '../engine/weapons.ts'
import type { HudState } from '../types/types.ts'

interface HudProps {
  hud: HudState
}

export function Hud({ hud }: HudProps) {
  const weapon = WEAPONS[hud.weapon]
  const healthTone = hud.health <= 25 ? 'is-critical' : hud.health <= 50 ? 'is-low' : ''

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-panel hud-stat">
          <span className="hud-label">Wave</span>
          <span className="hud-value">{hud.wave}</span>
        </div>
        <div className="hud-panel hud-stat">
          <span className="hud-label">Hostiles</span>
          <span className="hud-value">{hud.enemiesLeft}</span>
        </div>
        <div className="hud-panel hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{hud.score.toLocaleString()}</span>
        </div>
      </div>

      {!hud.scoped && <div className="crosshair" />}

      {hud.banner && (
        <div key={hud.bannerId} className="banner">
          {hud.banner}
        </div>
      )}

      <div className="hud-bottom">
        <div className="hud-left">
          {hud.squad.length > 0 && (
            <ul className="hud-panel hud-squad">
              {hud.squad.map((member) => (
                <li key={member.name} className={member.health <= 0 ? 'is-down' : ''}>
                  <span className="squad-name">{member.name}</span>
                  <span className="squad-health">{member.health > 0 ? member.health : 'Down'}</span>
                  <div className="health-bar">
                    <div className="health-fill" style={{ width: `${member.health}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className={`hud-panel hud-vitals ${healthTone}`}>
            <span className="hud-label">Health</span>
            <span className="hud-value hud-big">{hud.health}</span>
            <div className="health-bar">
              <div className="health-fill" style={{ width: `${hud.health}%` }} />
            </div>
          </div>
        </div>

        <div className={`hud-panel hud-arsenal ${hud.mag === 0 ? 'is-empty' : ''}`}>
          <div className="weapon-slots">
            {WEAPON_ORDER.map((id) => {
              const owned = hud.owned.includes(id)
              const active = id === hud.weapon
              return (
                <span key={id} className={`weapon-slot ${owned ? 'is-owned' : ''} ${active ? 'is-active' : ''}`}>
                  {WEAPONS[id].slot}
                </span>
              )
            })}
          </div>
          <span className="hud-label">{weapon.name}</span>
          <span className="hud-value hud-big">
            {hud.mag}
            <span className="hud-mag-reserve"> / {hud.reserve}</span>
          </span>
          <span className="hud-reserve">
            {hud.reloading
              ? 'Reloading...'
              : hud.mag === 0 && hud.reserve > 0
                ? 'Press R to reload'
                : `Bullets ${hud.bullets} · Shells ${hud.shells}`}
          </span>
        </div>
      </div>
    </div>
  )
}
