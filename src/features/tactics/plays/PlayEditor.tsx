import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ArrowRight, CircleHelp, CopyPlus, Eraser, MessageSquareText, Move, Pencil, Play, Plus, Save, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, Pill, SelectField } from '../../../components/ui'
import { supabase } from '../../../lib/supabase/client'
import type { PlayNote, PlayPath, PlayStep, PlayToken, PlayZone, Player, TacticalPlay } from '../../../lib/types'
import { PlaySimulation } from './PlaySimulation'

const blankStep = (title = 'Paso 1'): PlayStep => ({ title, players: [], paths: [], zones: [], notes: [] })
type Tool = 'move' | 'run' | 'pass' | 'zone' | 'note'
type Point = { x: number; y: number }
type BoardMode = 'edit' | 'simulate'

function NewPitch() {
  return <svg className="pitch-lines play-pitch-lines" viewBox="0 0 320 460" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <marker id="run-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#B6F23B" /></marker>
      <marker id="pass-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#D7E1E7" /></marker>
    </defs>
    <rect x="9" y="9" width="302" height="442" rx="3" />
    <line x1="9" y1="230" x2="311" y2="230" /><circle cx="160" cy="230" r="39" /><circle className="pitch-dot" cx="160" cy="230" r="2.2" />
    <rect x="73" y="9" width="174" height="70" /><rect x="115" y="9" width="90" height="28" />
    <rect x="73" y="381" width="174" height="70" /><rect x="115" y="423" width="90" height="28" />
    <circle className="pitch-dot" cx="160" cy="42" r="2.2" /><circle className="pitch-dot" cx="160" cy="418" r="2.2" />
  </svg>
}

function ReadOnlyPlayPanel({ play, onClose }: { play: TacticalPlay; onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0)
  const [mode, setMode] = useState<'steps' | 'simulate'>('steps')
  const steps = play.steps ?? []
  const step = steps[activeStep]
  return <Card className="play-readonly-card">
    <div className="readonly-play-card-top">
      <div><span className="eyebrow">JUGADA PUBLICADA · {play.category.toUpperCase()}</span><h3>{play.title}</h3></div>
      <Button variant="ghost" size="sm" onClick={onClose}><X size={14} /> Cerrar</Button>
    </div>
    <div className="play-mode-tabs" role="tablist" aria-label="Vista de la jugada">
      <button type="button" className={mode === 'steps' ? 'active' : ''} onClick={() => setMode('steps')}>Pasos</button>
      <button type="button" className={mode === 'simulate' ? 'active' : ''} onClick={() => setMode('simulate')} disabled={steps.length < 2}>Simulación</button>
    </div>
    {mode === 'simulate' ? (
      <PlaySimulation steps={steps} markerPrefix={`ro-${play.id.slice(0, 8)}`} />
    ) : step ? <>
      <div className="play-stage-wrap"><div className="field-stage play-stage play-readonly-stage"><NewPitch /><svg className="play-drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Pizarra táctica, ${step.title}`}>
        <defs><marker id="readonly-run-head" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#B6F23B" /></marker><marker id="readonly-pass-head" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#D7E1E7" /></marker></defs>
        {step.zones.map((zone) => <g key={zone.id}><rect className="play-zone-rect" x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="2" /><text className="play-zone-label" x={zone.x + 1.5} y={zone.y + 5}>{zone.label}</text></g>)}
        {step.paths.map((path) => <line key={path.id} className={`play-path ${path.kind}`} x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} markerEnd={`url(#readonly-${path.kind === 'run' ? 'run' : 'pass'}-head)`} />)}
        {step.notes.map((note) => <g key={note.id}><circle className="play-note-dot" cx={note.x} cy={note.y} r="1.6" /><text className="play-note-text" x={note.x + 2.5} y={note.y + 1.5}>{note.text.slice(0, 20)}</text></g>)}
      </svg>{step.players.map((token) => <span key={token.id} className="field-player play-token readonly-play-token" style={{ left: `${token.x}%`, top: `${token.y}%` }}><span className="player-token-number">{token.number ?? '·'}</span><span className="player-token-name">{token.label}</span></span>)}</div></div>
      <div className="readonly-step-caption"><Pill tone="lime">PASO {activeStep + 1}</Pill><strong>{step.title}</strong></div>
      <div className="step-buttons readonly-step-buttons">{steps.map((item, index) => <button key={`${item.title}-${index}`} type="button" className={index === activeStep ? 'step-button active' : 'step-button'} onClick={() => setActiveStep(index)}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}</button>)}</div>
    </> : <EmptyState title="Esta jugada no tiene pasos" detail="Pide al entrenador que añada al menos una fase." />}
  </Card>
}

export function PlayEditor() {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach'
  const [players, setPlayers] = useState<Player[]>([])
  const [plays, setPlays] = useState<TacticalPlay[]>([])
  const [viewingPlay, setViewingPlay] = useState<TacticalPlay | null>(null)
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('Nueva jugada')
  const [category, setCategory] = useState('Salida de balón')
  const [published, setPublished] = useState(false)
  const [steps, setSteps] = useState<PlayStep[]>([blankStep()])
  const [stepIndex, setStepIndex] = useState(0)
  const [boardMode, setBoardMode] = useState<BoardMode>('edit')
  const [dragGhost, setDragGhost] = useState<{ player: Player; x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool>('move')
  const [zoneLabel, setZoneLabel] = useState('Zona')
  const [noteText, setNoteText] = useState('')
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [drawPreview, setDrawPreview] = useState<{ start: Point; end: Point } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const drawStart = useRef<Point | null>(null)
  const dragToken = useRef<string | null>(null)
  const current = steps[stepIndex] ?? blankStep()

  async function loadData() {
    if (!supabase || !profile) return
    setLoading(true)
    const [rosterResult, playResult] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', profile.team_id).order('jersey_number'),
      supabase.from('tactical_plays').select('*').eq('team_id', profile.team_id).order('updated_at', { ascending: false }),
    ])
    const failed = rosterResult.error || playResult.error
    if (failed) setError('No se pudieron cargar las jugadas. Comprueba la migración y las políticas RLS.')
    setPlayers((rosterResult.data as Player[] | null) ?? [])
    const all = (playResult.data as TacticalPlay[] | null) ?? []
    setPlays(isCoach ? all : all.filter((item) => item.published))
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [profile?.team_id, profile?.role])

  const placedIds = useMemo(() => new Set(current.players.map((item) => item.player_id).filter((id): id is string => Boolean(id))), [current.players])

  function updateStep(transform: (step: PlayStep) => PlayStep) {
    setSteps((previous) => previous.map((step, index) => index === stepIndex ? transform(step) : step))
  }

  function toPoint(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return { x: 50, y: 50 }
    return {
      x: Math.max(2, Math.min(98, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(2, Math.min(98, ((event.clientY - bounds.top) / bounds.height) * 100)),
    }
  }

  function onBoardDown(event: PointerEvent<HTMLDivElement>) {
    if (tool === 'move' || boardMode !== 'edit') return
    event.preventDefault()
    const point = toPoint(event)
    drawStart.current = point
    setDrawPreview({ start: point, end: point })
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  function onBoardMove(event: PointerEvent<HTMLDivElement>) {
    if (boardMode !== 'edit') return
    const point = toPoint(event)
    if (dragToken.current) {
      updateStep((step) => ({ ...step, players: step.players.map((token) => token.id === dragToken.current ? { ...token, x: point.x, y: point.y } : token) }))
    } else if (drawStart.current) {
      setDrawPreview({ start: drawStart.current, end: point })
    }
  }

  function onBoardUp(event: PointerEvent<HTMLDivElement>) {
    if (boardMode !== 'edit') return
    if (dragToken.current) { dragToken.current = null; return }
    if (!drawStart.current) return
    const start = drawStart.current
    const end = toPoint(event)
    drawStart.current = null
    setDrawPreview(null)
    const id = crypto.randomUUID()
    if (tool === 'run' || tool === 'pass') {
      const path: PlayPath = { id, kind: tool, x1: start.x, y1: start.y, x2: end.x, y2: end.y }
      updateStep((step) => ({ ...step, paths: [...step.paths, path] }))
    } else if (tool === 'zone') {
      const width = Math.max(4, Math.abs(end.x - start.x))
      const height = Math.max(4, Math.abs(end.y - start.y))
      const zone: PlayZone = { id, x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height, label: zoneLabel.trim() || 'Zona' }
      updateStep((step) => ({ ...step, zones: [...step.zones, zone] }))
    } else if (tool === 'note') {
      if (!noteText.trim()) { setError('Escribe el texto de la referencia antes de colocarla.'); return }
      const note: PlayNote = { id, x: end.x, y: end.y, text: noteText.trim() }
      updateStep((step) => ({ ...step, notes: [...step.notes, note] }))
      setNoteText('')
      setTool('move')
    }
  }

  function placePlayer(player: Player, point?: Point) {
    updateStep((step) => {
      if (step.players.some((token) => token.player_id === player.id)) return step
      const count = step.players.length
      const token: PlayToken = {
        id: crypto.randomUUID(),
        player_id: player.id,
        label: player.full_name.split(' ')[0],
        number: player.jersey_number,
        x: point?.x ?? 30 + ((count % 3) * 20),
        y: point?.y ?? 30 + ((count % 4) * 12),
      }
      return { ...step, players: [...step.players, token] }
    })
  }

  function removePlayer(playerId: string) {
    updateStep((step) => ({ ...step, players: step.players.filter((token) => token.player_id !== playerId) }))
  }

  function startRosterDrag(event: PointerEvent<HTMLButtonElement>, player: Player) {
    if (boardMode !== 'edit') return
    event.preventDefault()
    const origin = { x: event.clientX, y: event.clientY }
    let moved = false
    setDragGhost({ player, x: origin.x, y: origin.y })

    const onMove = (e: { clientX: number; clientY: number }) => {
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 6) moved = true
      setDragGhost({ player, x: e.clientX, y: e.clientY })
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', cleanup)
      setDragGhost(null)
    }
    const onUp = (e: { clientX: number; clientY: number }) => {
      const bounds = stageRef.current?.getBoundingClientRect()
      cleanup()
      if (!moved) { placePlayer(player); return }
      if (!bounds) return
      const inside = e.clientX >= bounds.left && e.clientX <= bounds.right && e.clientY >= bounds.top && e.clientY <= bounds.bottom
      if (!inside) return
      placePlayer(player, {
        x: Math.max(4, Math.min(96, ((e.clientX - bounds.left) / bounds.width) * 100)),
        y: Math.max(4, Math.min(96, ((e.clientY - bounds.top) / bounds.height) * 100)),
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', cleanup)
  }

  function addStep() {
    const copiedPlayers = current.players.map((token) => ({ ...token }))
    const next = [...steps, { title: `Paso ${steps.length + 1}`, players: copiedPlayers, paths: [], zones: [], notes: [] }]
    setSteps(next)
    setStepIndex(next.length - 1)
    setBoardMode('edit')
    setTool('move')
    setSuccess(`Paso ${next.length} creado. Mueve jugadores y dibuja la acción de esta fase.`)
  }

  function newPlay() {
    setSelectedPlayId(null)
    setTitle('Nueva jugada')
    setCategory('Salida de balón')
    setPublished(false)
    setSteps([blankStep()])
    setStepIndex(0)
    setBoardMode('edit')
    setError(null)
    setSuccess(null)
    setTool('move')
  }

  function openPlay(play: TacticalPlay) {
    setSelectedPlayId(play.id)
    setTitle(play.title)
    setCategory(play.category)
    setPublished(play.published)
    setSteps(play.steps?.length ? play.steps : [blankStep()])
    setStepIndex(0)
    setBoardMode('edit')
    setError(null)
    setSuccess(null)
    setTool('move')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function savePlay() {
    if (!supabase || !profile) return
    if (!title.trim()) { setError('Escribe un nombre para la jugada.'); return }
    if (steps.every((step) => step.players.length === 0 && step.paths.length === 0 && step.zones.length === 0 && step.notes.length === 0)) { setError('Añade jugadores o elementos tácticos a la pizarra.'); return }
    setBusy(true)
    setError(null)
    setSuccess(null)
    const values = { team_id: profile.team_id, created_by: profile.id, title: title.trim(), category, steps, published }
    const response = selectedPlayId
      ? await supabase.from('tactical_plays').update(values).eq('id', selectedPlayId).eq('team_id', profile.team_id)
      : await supabase.from('tactical_plays').insert(values)
    if (response.error) setError('No se pudo guardar la jugada. Comprueba que tu sesión tenga rol de entrenador.')
    else setSuccess(published ? 'Jugada publicada para el equipo.' : 'Jugada guardada como borrador.')
    await loadData()
    setBusy(false)
  }

  async function deletePlay(play: TacticalPlay) {
    if (!supabase || !window.confirm(`¿Eliminar “${play.title}”? Esta acción no se puede deshacer.`)) return
    const { error: deleteError } = await supabase.from('tactical_plays').delete().eq('id', play.id).eq('team_id', profile?.team_id)
    if (deleteError) setError('No se pudo eliminar la jugada.')
    else { if (selectedPlayId === play.id) newPlay(); setSuccess('Jugada eliminada.'); await loadData() }
  }

  if (loading) return <Card><LoadingState label="Cargando pizarra táctica…" /></Card>

  const tools: { id: Tool; label: string; Icon: typeof Move }[] = [
    { id: 'move', label: 'Mover', Icon: Move }, { id: 'run', label: 'Movimiento', Icon: ArrowRight }, { id: 'pass', label: 'Pase', Icon: ArrowRight }, { id: 'zone', label: 'Zona', Icon: Plus }, { id: 'note', label: 'Texto', Icon: MessageSquareText },
  ]

  return <div className="play-editor-page">
    {error && <InlineMessage tone="error">{error}</InlineMessage>}
    {success && <InlineMessage tone="success">{success}</InlineMessage>}
    {isCoach && <div className="play-editor-grid">
      <div className="play-board-column">
        <Card className="play-board-card">
          <div className="pitch-card-header">
            <div><span className="eyebrow">PIZARRA TÁCTICA</span><h2>{selectedPlayId ? 'Editar jugada' : 'Diseña la jugada'}</h2></div>
            {boardMode === 'edit' && <Pill tone="lime">PASO {stepIndex + 1}</Pill>}
          </div>
          <div className="play-mode-tabs" role="tablist" aria-label="Modo de pizarra">
            <button type="button" className={boardMode === 'edit' ? 'active' : ''} onClick={() => setBoardMode('edit')}>Editar pasos</button>
            <button type="button" className={boardMode === 'simulate' ? 'active' : ''} onClick={() => setBoardMode('simulate')} disabled={steps.length < 2}>
              <Play size={13} /> Simulación
            </button>
          </div>

          {boardMode === 'simulate' ? (
            <PlaySimulation key={`${selectedPlayId ?? 'draft'}-${steps.length}`} steps={steps} markerPrefix="editor-sim" />
          ) : <>
            

            <div className="play-tools" role="toolbar" aria-label="Herramientas de pizarra">{tools.map(({ id, label, Icon }) => <button className={tool === id ? 'play-tool active' : 'play-tool'} key={id} type="button" onClick={() => setTool(id)}><Icon size={15} /><span>{label}</span></button>)}</div>
            {tool === 'note' && <Field className="play-note-field" label="Texto de la referencia" value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Ej. Fijar al central" />}
            {tool === 'zone' && <Field className="play-note-field" label="Etiqueta de zona" value={zoneLabel} onChange={(event) => setZoneLabel(event.target.value)} placeholder="Zona de presión" />}
            <div className="play-stage-wrap">
              <div ref={stageRef} className={`field-stage play-stage ${tool !== 'move' ? 'tool-active' : ''}`} onPointerDown={onBoardDown} onPointerMove={onBoardMove} onPointerUp={onBoardUp} onPointerCancel={onBoardUp}>
                <NewPitch />
                <svg className="play-drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Elementos de la jugada">
                  <defs><marker id="editor-run-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#B6F23B" /></marker><marker id="editor-pass-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#D7E1E7" /></marker></defs>
                  {current.zones.map((zone) => <g key={zone.id}><rect className="play-zone-rect" x={zone.x} y={zone.y} width={zone.width} height={zone.height} rx="2" /><text className="play-zone-label" x={zone.x + 1.5} y={zone.y + 5}>{zone.label}</text></g>)}
                  {current.paths.map((path) => <line key={path.id} className={`play-path ${path.kind}`} x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} markerEnd={`url(#editor-${path.kind === 'run' ? 'run' : 'pass'}-head)`} />)}
                  {drawPreview && (tool === 'run' || tool === 'pass') && <line className={`play-path preview ${tool}`} x1={drawPreview.start.x} y1={drawPreview.start.y} x2={drawPreview.end.x} y2={drawPreview.end.y} />}
                  {drawPreview && tool === 'zone' && <rect className="play-zone-rect preview" x={Math.min(drawPreview.start.x, drawPreview.end.x)} y={Math.min(drawPreview.start.y, drawPreview.end.y)} width={Math.max(2, Math.abs(drawPreview.end.x - drawPreview.start.x))} height={Math.max(2, Math.abs(drawPreview.end.y - drawPreview.start.y))} />}
                  {current.notes.map((note) => <g key={note.id}><circle className="play-note-dot" cx={note.x} cy={note.y} r="1.6" /><text className="play-note-text" x={note.x + 2.5} y={note.y + 1.5}>{note.text.slice(0, 20)}</text></g>)}
                </svg>
                {current.players.map((token) => <button key={token.id} type="button" className="field-player play-token" style={{ left: `${token.x}%`, top: `${token.y}%` }} onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); dragToken.current = token.id; stageRef.current?.setPointerCapture(event.pointerId) }} aria-label={`Mover ${token.label}`}><span className="player-token-number">{token.number ?? '·'}</span><span className="player-token-name">{token.label}</span></button>)}
              </div>
              <div className="pitch-caption"><Move size={13} /> {tool === 'move' ? 'Arrastra jugadores para ajustar su posición' : 'Toca y arrastra sobre el campo para dibujar'}</div>
            </div>
            <div className="step-strip">
              <div className="step-buttons">{steps.map((step, index) => <button key={index} type="button" className={index === stepIndex ? 'step-button active' : 'step-button'} onClick={() => setStepIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{step.title}</button>)}</div>
              <Button variant="secondary" size="sm" onClick={addStep}><CopyPlus size={14} /> Nuevo paso</Button>
            </div>
            <div className="step-title-row"><Field label="Nombre del paso" value={current.title} maxLength={50} onChange={(event) => updateStep((step) => ({ ...step, title: event.target.value }))} /><div className="step-edit-buttons"><Button variant="ghost" size="sm" disabled={steps.length < 2} onClick={() => { const next = steps.filter((_, index) => index !== stepIndex); setSteps(next); setStepIndex(Math.max(0, stepIndex - 1)) }}><Eraser size={14} /> Borrar paso</Button><Button variant="ghost" size="sm" onClick={() => updateStep((step) => ({ ...step, paths: [], zones: [], notes: [] }))}><Eraser size={14} /> Limpiar trazos</Button></div></div>
          </>}
        </Card>
      </div>
      <div className="play-controls-column">
        <Card className="play-setup-card">
          <div className="section-head"><h2>Detalles</h2>{selectedPlayId && <Pill>Edición</Pill>}</div>
          <Field label="Nombre de la jugada" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Córner al segundo palo" />
          <SelectField label="Tipo de jugada" value={category} onChange={(event) => setCategory(event.target.value)}>{['Salida de balón', 'Córner', 'Falta', 'Contraataque', 'Defensa', 'Otro'].map((item) => <option key={item}>{item}</option>)}</SelectField>
          <div className="roster-dock">
  <div className="roster-dock-head">
    <span>Añadir jugadores</span>
    <small>{placedIds.size}/{players.length} en campo</small>
  </div>
  {players.length ? (
    <div className="roster-dock-grid">
      {players.map((player) => {
        const placed = placedIds.has(player.id)
        return (
          <button
            key={player.id}
            type="button"
            className={placed ? 'roster-token placed' : 'roster-token'}
            disabled={boardMode !== 'edit'}
            onPointerDown={placed ? undefined : (event) => startRosterDrag(event, player)}
            onClick={placed ? () => removePlayer(player.id) : undefined}
            title={placed ? 'Quitar del campo' : 'Arrastra al campo'}
          >
            <b>{player.jersey_number ?? '·'}</b>
            <span>{player.full_name.split(' ')[0]}</span>
          </button>
        )
      })}
    </div>
  ) : (
    <p className="bench-empty">Añade jugadores a la plantilla para colocarlos aquí.</p>
  )}
  <p className="roster-dock-hint">Arrastra al campo o toca para colocar. Toca uno colocado para quitarlo.</p>
</div>
         
          <div className="play-legend"><span><i className="legend-run" /> Movimiento</span><span><i className="legend-pass" /> Pase</span><span><i className="legend-zone" /> Zona</span><span><i className="legend-note" /> Referencia</span></div>
          <label className="publish-switch"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /><span className="switch-visual" /><span><strong>Publicar al equipo</strong><small>Visible para los jugadores</small></span></label>
          <div className="lineup-actions"><Button onClick={() => void savePlay()} disabled={busy}>{busy ? 'Guardando…' : <><Save size={15} /> Guardar jugada</>}</Button>{selectedPlayId && <Button variant="secondary" onClick={newPlay}><X size={14} /> Nueva</Button>}</div>
          {!players.length && <InlineMessage tone="info"><Users size={14} /> Añade jugadores a la plantilla para colocarlos en la pizarra.</InlineMessage>}
        </Card>
        <Card className="play-help-card"><CircleHelp size={16} /><p>1) Arrastra jugadores de la plantilla al campo y dibuja el paso. 2) Pulsa <b>Nuevo paso</b>, mueve fichas y dibuja la siguiente fase. 3) Abre <b>Simulación</b> para ver todos los pasos seguidos.</p></Card>
      </div>
    </div>}

    {!isCoach && viewingPlay && <ReadOnlyPlayPanel play={viewingPlay} onClose={() => setViewingPlay(null)} />}
    <div className="section-head saved-plays-head"><h2>{isCoach ? 'Jugadas guardadas' : 'Jugadas publicadas'}</h2>{isCoach && <Button variant="ghost" size="sm" onClick={newPlay}><Plus size={14} /> Nueva jugada</Button>}</div>
    {plays.length ? <div className="saved-plays-grid">{plays.map((play) => <Card className="saved-play-card" key={play.id}>
      <div className="saved-play-top"><div className="play-icon"><ArrowRight size={17} /></div><div className="saved-play-title"><strong>{play.title}</strong><small>{play.category} · {play.steps?.length ?? 0} pasos</small></div><Pill tone={play.published ? 'lime' : 'neutral'}>{play.published ? 'Publicada' : 'Borrador'}</Pill></div>
      <div className="saved-play-step-list">{(play.steps ?? []).map((step, index) => <span key={index}>{String(index + 1).padStart(2, '0')} · {step.title}</span>)}</div>
      <div className="saved-play-actions">{isCoach && <Button variant="secondary" size="sm" onClick={() => openPlay(play)}><Pencil size={14} /> Abrir</Button>}{isCoach && <Button variant="ghost" size="sm" onClick={() => void deletePlay(play)}><Trash2 size={14} /> Eliminar</Button>}{!isCoach && <Button variant="secondary" size="sm" onClick={() => setViewingPlay(play)}><ArrowRight size={14} /> Ver pizarra</Button>}</div>
    </Card>)}</div> : <Card><EmptyState icon={<CircleHelp size={18} />} title={isCoach ? 'Aún no hay jugadas guardadas' : 'Aún no hay jugadas publicadas'} detail={isCoach ? 'Diseña una acción para preparar el siguiente partido.' : 'Las jugadas publicadas por el entrenador aparecerán aquí.'} /></Card>}

    {dragGhost && (
      <span className="roster-ghost" style={{ left: dragGhost.x, top: dragGhost.y }}>
        {dragGhost.player.jersey_number ?? '·'}
      </span>
    )}
  </div>
}