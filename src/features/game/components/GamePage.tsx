import { useEffect, useRef, useState } from 'react'
import { Engine, loadBest, loadSensitivity } from '../engine/engine.ts'
import type { GameResult, HudState, Phase } from '../types/types.ts'
import { Hud } from './Hud.tsx'
import { Overlay } from './Overlay.tsx'
import './game.css'

export function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const [phase, setPhase] = useState<Phase>('menu')
  const [hud, setHud] = useState<HudState | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [sensitivity, setSensitivity] = useState(loadSensitivity)
  const [initialBest] = useState(loadBest)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, { onHud: setHud, onPhase: setPhase, onResult: setResult })
    engineRef.current = engine
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  const changeSensitivity = (value: number) => {
    setSensitivity(value)
    engineRef.current?.setSensitivity(value)
  }

  return (
    <main className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      {phase !== 'menu' && hud && <Hud hud={hud} />}
      <Overlay
        phase={phase}
        result={result}
        best={result?.best ?? initialBest}
        sensitivity={sensitivity}
        onStart={() => engineRef.current?.start()}
        onResume={() => engineRef.current?.resume()}
        onQuit={() => engineRef.current?.quit()}
        onSensitivity={changeSensitivity}
      />
    </main>
  )
}
