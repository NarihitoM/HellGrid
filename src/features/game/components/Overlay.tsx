import type { GameResult, Phase } from '../types/types.ts'

interface OverlayProps {
  phase: Phase
  result: GameResult | null
  best: number
  sensitivity: number
  onStart: () => void
  onResume: () => void
  onQuit: () => void
  onSensitivity: (value: number) => void
}

const CONTROLS: [string, string][] = [
  ['WASD', 'Move'],
  ['Mouse', 'Look'],
  ['Click / Space', 'Fire'],
  ['Right click', 'Aim / Scope'],
  ['R', 'Reload'],
  ['F', 'Inspect'],
  ['Shift', 'Sprint'],
  ['1-4 / Wheel', 'Weapons'],
  ['Esc', 'Pause'],
]

export function Overlay({ phase, result, best, sensitivity, onStart, onResume, onQuit, onSensitivity }: OverlayProps) {
  if (phase === 'playing') return null

  if (phase === 'paused') {
    return (
      <div className="overlay is-dim">
        <section className="card">
          <h2 className="card-title">Paused</h2>
          <label className="setting">
            <span>
              Mouse sensitivity <strong>{sensitivity.toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={0.2}
              max={3}
              step={0.05}
              value={sensitivity}
              onChange={(event) => onSensitivity(Number(event.target.value))}
            />
          </label>
          <div className="actions">
            <button type="button" className="button is-primary" onClick={onResume}>
              Resume
            </button>
            <button type="button" className="button" onClick={onQuit}>
              Quit to menu
            </button>
          </div>
        </section>
      </div>
    )
  }

  if (phase === 'dead' && result) {
    return (
      <div className="overlay is-blood">
        <section className="card">
          <h2 className="card-title is-danger">You died</h2>
          {result.record && <p className="record">New high score</p>}
          <dl className="results">
            <div>
              <dt>Score</dt>
              <dd>{result.score.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Wave</dt>
              <dd>{result.wave}</dd>
            </div>
            <div>
              <dt>Kills</dt>
              <dd>{result.kills}</dd>
            </div>
            <div>
              <dt>Best</dt>
              <dd>{result.best.toLocaleString()}</dd>
            </div>
          </dl>
          <div className="actions">
            <button type="button" className="button is-primary" onClick={onStart}>
              Play again
            </button>
            <button type="button" className="button" onClick={onQuit}>
              Main menu
            </button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="overlay">
      <section className="title-screen">
        <p className="eyebrow">A raycast survival shooter</p>
        <h1 className="logo">Hellgrid</h1>
        <p className="tagline">Hold the halls. Survive the waves. Earn heavier guns.</p>
        <button type="button" className="button is-primary is-large" onClick={onStart}>
          Deploy
        </button>
        {best > 0 && <p className="best">Best score {best.toLocaleString()}</p>}
        <ul className="controls">
          {CONTROLS.map(([keys, action]) => (
            <li key={action}>
              <kbd>{keys}</kbd>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
