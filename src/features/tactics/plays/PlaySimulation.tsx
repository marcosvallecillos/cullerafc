import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button, Pill } from '../../../components/ui'
import type { PlayNote, PlayPath, PlayStep, PlayToken, PlayZone } from '../../../lib/types'

const MOVE_MS = 1100
const HOLD_MS = 900

export type SimFrame = {
  stepIndex: number
  title: string
  players: PlayToken[]
  paths: PlayPath[]
  zones: PlayZone[]
  notes: PlayNote[]
  pathProgress: number
  drawingOpacity: number
}

function tokenKey(token: PlayToken) {
  return token.player_id || token.id
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function matchToken(from: PlayToken[], key: string) {
  return from.find((token) => tokenKey(token) === key)
}

/** Interpola jugadores del paso A → B; dibujos del destino aparecen al avanzar. */
export function buildSimFrame(steps: PlayStep[], elapsedMs: number): SimFrame {
  const safe = steps.length ? steps : [{ title: 'Paso 1', players: [], paths: [], zones: [], notes: [] }]
  if (safe.length === 1) {
    return {
      stepIndex: 0,
      title: safe[0].title,
      players: safe[0].players,
      paths: safe[0].paths,
      zones: safe[0].zones,
      notes: safe[0].notes,
      pathProgress: 1,
      drawingOpacity: 1,
    }
  }

  const segment = MOVE_MS + HOLD_MS
  const total = (safe.length - 1) * segment + HOLD_MS
  const clamped = Math.min(Math.max(elapsedMs, 0), total)

  if (clamped <= HOLD_MS) {
    const first = safe[0]
    return {
      stepIndex: 0,
      title: first.title,
      players: first.players,
      paths: first.paths,
      zones: first.zones,
      notes: first.notes,
      pathProgress: 1,
      drawingOpacity: 1,
    }
  }

  const afterFirst = clamped - HOLD_MS
  const transitionIndex = Math.min(safe.length - 2, Math.floor(afterFirst / segment))
  const local = afterFirst - transitionIndex * segment
  const from = safe[transitionIndex]
  const to = safe[transitionIndex + 1]

  if (local < MOVE_MS) {
    const t = easeInOut(local / MOVE_MS)
    const keys = new Set([...from.players.map(tokenKey), ...to.players.map(tokenKey)])
    const players: PlayToken[] = []
    keys.forEach((key) => {
      const a = matchToken(from.players, key)
      const b = matchToken(to.players, key)
      if (a && b) {
        players.push({ ...b, id: b.id, x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })
      } else if (b) {
        players.push({ ...b, x: b.x, y: b.y })
      } else if (a && t < 0.85) {
        players.push(a)
      }
    })
    return {
      stepIndex: transitionIndex + 1,
      title: to.title,
      players,
      paths: to.paths,
      zones: to.zones,
      notes: to.notes,
      pathProgress: t,
      drawingOpacity: Math.min(1, t * 1.25),
    }
  }

  return {
    stepIndex: transitionIndex + 1,
    title: to.title,
    players: to.players,
    paths: to.paths,
    zones: to.zones,
    notes: to.notes,
    pathProgress: 1,
    drawingOpacity: 1,
  }
}

export function simulationDuration(steps: PlayStep[]) {
  if (steps.length <= 1) return HOLD_MS
  return (steps.length - 1) * (MOVE_MS + HOLD_MS) + HOLD_MS
}

function PitchLines({ markerPrefix }: { markerPrefix: string }) {
  return (
    <svg className="pitch-lines play-pitch-lines" viewBox="0 0 320 460" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id={`${markerPrefix}-run-head`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#B6F23B" /></marker>
        <marker id={`${markerPrefix}-pass-head`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#D7E1E7" /></marker>
      </defs>
      <rect x="9" y="9" width="302" height="442" rx="3" />
      <line x1="9" y1="230" x2="311" y2="230" /><circle cx="160" cy="230" r="39" /><circle className="pitch-dot" cx="160" cy="230" r="2.2" />
      <rect x="73" y="9" width="174" height="70" /><rect x="115" y="9" width="90" height="28" />
      <rect x="73" y="381" width="174" height="70" /><rect x="115" y="423" width="90" height="28" />
      <circle className="pitch-dot" cx="160" cy="42" r="2.2" /><circle className="pitch-dot" cx="160" cy="418" r="2.2" />
    </svg>
  )
}

function pathLength(path: PlayPath) {
  return Math.hypot(path.x2 - path.x1, path.y2 - path.y1) || 1
}

export function PlayBoardFrame({
  frame,
  markerPrefix,
  className = '',
}: {
  frame: SimFrame
  markerPrefix: string
  className?: string
}) {
  return (
    <div className={`field-stage play-stage play-readonly-stage ${className}`}>
      <PitchLines markerPrefix={markerPrefix} />
      <svg className="play-drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ opacity: frame.drawingOpacity }} aria-hidden="true">
        {frame.zones.map((zone) => (
          <g key={zone.id}>
            <rect className="play-zone-rect" x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="2" />
            <text className="play-zone-label" x={zone.x + 1.5} y={zone.y + 5}>{zone.label}</text>
          </g>
        ))}
        {frame.paths.map((path) => {
          const len = pathLength(path)
          const visible = Math.max(0.01, len * frame.pathProgress)
          return (
            <line
              key={path.id}
              className={`play-path play-path-sim ${path.kind}`}
              x1={path.x1}
              y1={path.y1}
              x2={path.x2}
              y2={path.y2}
              style={{ strokeDasharray: `${visible} ${Math.max(len, 0.01)}` }}
              markerEnd={frame.pathProgress > 0.92 ? `url(#${markerPrefix}-${path.kind === 'run' ? 'run' : 'pass'}-head)` : undefined}
            />
          )
        })}
        {frame.notes.map((note) => (
          <g key={note.id}>
            <circle className="play-note-dot" cx={note.x} cy={note.y} r="1.6" />
            <text className="play-note-text" x={note.x + 2.5} y={note.y + 1.5}>{note.text.slice(0, 20)}</text>
          </g>
        ))}
      </svg>
      {frame.players.map((token) => (
        <span key={token.id} className="field-player play-token readonly-play-token" style={{ left: `${token.x}%`, top: `${token.y}%` }}>
          <span className="player-token-number">{token.number ?? '·'}</span>
          <span className="player-token-name">{token.label}</span>
        </span>
      ))}
    </div>
  )
}

export function PlaySimulation({
  steps,
  markerPrefix = 'sim',
}: {
  steps: PlayStep[]
  markerPrefix?: string
}) {
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const playingRef = useRef(false)
  const elapsedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastTs = useRef<number | null>(null)
  const duration = simulationDuration(steps)
  const frame = buildSimFrame(steps, elapsed)

  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    if (!playing) {
      lastTs.current = null
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const tick = (ts: number) => {
      if (!playingRef.current) return
      if (lastTs.current == null) lastTs.current = ts
      const delta = ts - lastTs.current
      lastTs.current = ts
      const next = Math.min(duration, elapsedRef.current + delta)
      setElapsed(next)
      if (next >= duration) {
        setPlaying(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, duration])

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  function restart() {
    setElapsed(0)
    setPlaying(true)
  }

  if (steps.length < 2) {
    return (
      <div className="play-sim-empty">
        <p>Crea al menos dos pasos para ver la simulación completa de la jugada.</p>
      </div>
    )
  }

  return (
    <div className="play-sim">
      <div className="play-sim-top">
        <Pill tone="lime">PASO {frame.stepIndex + 1}/{steps.length}</Pill>
        <strong>{frame.title}</strong>
      </div>
      <div className="play-stage-wrap">
        <PlayBoardFrame frame={frame} markerPrefix={markerPrefix} />
      </div>
      <div className="play-sim-progress" aria-hidden="true">
        <span style={{ width: `${duration ? (elapsed / duration) * 100 : 0}%` }} />
      </div>
      <div className="play-sim-controls">
        {playing ? (
          <Button variant="secondary" size="sm" onClick={() => setPlaying(false)}><Pause size={14} /> Pausa</Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => {
            if (elapsed >= duration) setElapsed(0)
            setPlaying(true)
          }}><Play size={14} /> {elapsed > 0 && elapsed < duration ? 'Continuar' : 'Simular'}</Button>
        )}
        <Button variant="ghost" size="sm" onClick={restart}><RotateCcw size={14} /> Desde el inicio</Button>
      </div>
    </div>
  )
}
