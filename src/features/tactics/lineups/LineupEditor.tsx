import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { CircleHelp, Grip, Pencil, Plus, Save, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, Pill, SelectField } from '../../../components/ui'
import { supabase } from '../../../lib/supabase/client'
import { formatDate } from '../../../lib/format'
import type { Lineup, LineupPlayer, MatchRecord, Player } from '../../../lib/types'

interface Position { x: number; y: number; label: string }
interface DraftSlot extends Position { player_id: string; slot_type: 'starter' | 'bench' }
interface SavedLineup extends Lineup { lineup_players?: (LineupPlayer & { players?: Pick<Player, 'id' | 'full_name' | 'jersey_number' | 'position'> })[] }

const FORMATIONS: Record<string, Position[]> = {
  '2-3-1': [
    { x: 50, y: 87, label: 'Portero' }, { x: 31, y: 68, label: 'Defensa' }, { x: 69, y: 68, label: 'Defensa' },
    { x: 19, y: 47, label: 'Medio' }, { x: 50, y: 50, label: 'Medio' }, { x: 81, y: 47, label: 'Medio' }, { x: 50, y: 25, label: 'Delantero' },
  ],
  '3-2-1': [
    { x: 50, y: 87, label: 'Portero' }, { x: 20, y: 69, label: 'Defensa' }, { x: 50, y: 71, label: 'Defensa' }, { x: 80, y: 69, label: 'Defensa' },
    { x: 34, y: 47, label: 'Medio' }, { x: 66, y: 47, label: 'Medio' }, { x: 50, y: 25, label: 'Delantero' },
  ],
  '2-1-2-1': [
    { x: 50, y: 87, label: 'Portero' }, { x: 30, y: 69, label: 'Defensa' }, { x: 70, y: 69, label: 'Defensa' }, { x: 50, y: 54, label: 'Medio' },
    { x: 31, y: 39, label: 'Banda' }, { x: 69, y: 39, label: 'Banda' }, { x: 50, y: 23, label: 'Delantero' },
  ],
  '3-1-2': [
    { x: 50, y: 87, label: 'Portero' }, { x: 20, y: 69, label: 'Defensa' }, { x: 50, y: 71, label: 'Defensa' }, { x: 80, y: 69, label: 'Defensa' },
    { x: 50, y: 49, label: 'Medio' }, { x: 34, y: 27, label: 'Delantero' }, { x: 66, y: 27, label: 'Delantero' },
  ],
}

const emptySlots = (formation: string): DraftSlot[] => FORMATIONS[formation].map((position) => ({ ...position, player_id: '', slot_type: 'starter' }))

function FootballPitch() {
  return <svg className="pitch-lines" viewBox="0 0 320 460" preserveAspectRatio="none" aria-hidden="true">
    <rect x="9" y="9" width="302" height="442" rx="3" />
    <line x1="9" y1="230" x2="311" y2="230" />
    <circle cx="160" cy="230" r="39" />
    <circle className="pitch-dot" cx="160" cy="230" r="2.2" />
    <rect x="73" y="9" width="174" height="70" />
    <rect x="115" y="9" width="90" height="28" />
    <path d="M122 79a38 38 0 0 0 76 0" />
    <rect x="73" y="381" width="174" height="70" />
    <rect x="115" y="423" width="90" height="28" />
    <path d="M122 381a38 38 0 0 1 76 0" />
    <circle className="pitch-dot" cx="160" cy="42" r="2.2" /><circle className="pitch-dot" cx="160" cy="418" r="2.2" />
  </svg>
}

function SavedPitch({ lineup }: { lineup: SavedLineup }) {
  const starters = (lineup.lineup_players ?? []).filter((slot) => slot.slot_type === 'starter')
  if (!starters.length) return null
  return <div className="saved-field-stage"><FootballPitch />{starters.map((slot) => <span className="saved-field-token" key={slot.id || slot.player_id} style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>{slot.players?.jersey_number ?? '·'}</span>)}</div>
}

export function LineupEditor() {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach'
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [lineups, setLineups] = useState<SavedLineup[]>([])
  const [formation, setFormation] = useState('2-3-1')
  const [slots, setSlots] = useState<DraftSlot[]>(emptySlots('2-3-1'))
  const [bench, setBench] = useState<DraftSlot[]>([])
  const [name, setName] = useState('Alineación')
  const [matchId, setMatchId] = useState('')
  const [published, setPublished] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragIndex = useRef<number | null>(null)

  async function loadData() {
    if (!supabase || !profile) return
    setLoading(true)
    const [rosterResult, matchResult, lineupResult] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', profile.team_id).order('jersey_number'),
      supabase.from('matches').select('*').eq('team_id', profile.team_id).eq('status', 'pending').order('match_date'),
      supabase.from('lineups').select('*, lineup_players(id, player_id, slot_type, x, y, position_label, players(id, full_name, jersey_number, position))').eq('team_id', profile.team_id).order('created_at', { ascending: false }),
    ])
    const failed = [rosterResult.error, matchResult.error, lineupResult.error].find(Boolean)
    if (failed) setError('No se pudieron cargar los datos tácticos. Comprueba la migración y las políticas RLS.')
    setPlayers((rosterResult.data as Player[] | null) ?? [])
    setMatches((matchResult.data as MatchRecord[] | null) ?? [])
    const visibleLineups = (lineupResult.data as unknown as SavedLineup[] | null) ?? []
    setLineups(isCoach ? visibleLineups : visibleLineups.filter((item) => item.published))
    setLoading(false)
  }

  useEffect(() => { void loadData() }, [profile?.team_id, profile?.role])

  const selectedPlayerIds = useMemo(() => new Set([...slots, ...bench].map((slot) => slot.player_id).filter(Boolean)), [slots, bench])
  const availablePlayers = players.filter((player) => !selectedPlayerIds.has(player.id))

  function changeFormation(value: string) {
    setFormation(value)
    setSlots((current) => FORMATIONS[value].map((position, index) => ({ ...position, player_id: current[index]?.player_id || '', slot_type: 'starter' })))
  }

  function moveToken(event: PointerEvent<HTMLDivElement>) {
    if (dragIndex.current === null || !stageRef.current) return
    const bounds = stageRef.current.getBoundingClientRect()
    const x = Math.max(6, Math.min(94, ((event.clientX - bounds.left) / bounds.width) * 100))
    const y = Math.max(6, Math.min(94, ((event.clientY - bounds.top) / bounds.height) * 100))
    setSlots((current) => current.map((slot, index) => index === dragIndex.current ? { ...slot, x, y } : slot))
  }

  function startDrag(index: number, event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    dragIndex.current = index
    stageRef.current?.setPointerCapture(event.pointerId)
  }

  function resetEditor() {
    setEditingId(null)
    setFormation('2-3-1')
    setSlots(emptySlots('2-3-1'))
    setBench([])
    setName('Alineación')
    setMatchId('')
    setPublished(false)
    setError(null)
    setSuccess(null)
  }

  function editLineup(lineup: SavedLineup) {
    setEditingId(lineup.id)
    setName(lineup.name)
    setFormation(FORMATIONS[lineup.formation] ? lineup.formation : '2-3-1')
    const layout = FORMATIONS[lineup.formation] ?? FORMATIONS['2-3-1']
    const starters = (lineup.lineup_players ?? []).filter((item) => item.slot_type === 'starter')
    setSlots(layout.map((position, index) => {
      const saved = starters[index]
      return { ...position, x: saved?.x ?? position.x, y: saved?.y ?? position.y, label: saved?.position_label || position.label, player_id: saved?.player_id || '', slot_type: 'starter' }
    }))
    setBench((lineup.lineup_players ?? []).filter((item) => item.slot_type === 'bench').map((item) => ({ x: item.x, y: item.y, label: item.position_label || 'Suplente', player_id: item.player_id, slot_type: 'bench' })))
    setMatchId(lineup.match_id ?? '')
    setPublished(lineup.published)
    setError(null)
    setSuccess(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveLineup(nextPublished = published) {
    if (!supabase || !profile) return
    if (!name.trim()) { setError('Escribe un nombre para la alineación.'); return }
    const placedStarters = slots.filter((slot) => slot.player_id)
    if (!placedStarters.length) { setError('Añade al menos un jugador antes de guardar.'); return }
    if (nextPublished && placedStarters.length !== 7) { setError('Para publicar la alineación, asigna los 7 titulares.'); return }
    setPublished(nextPublished)
    setSaving(true)
    setError(null)
    setSuccess(null)
    const values = { team_id: profile.team_id, created_by: profile.id, match_id: matchId || null, name: name.trim(), formation, published: nextPublished }
    let id = editingId
    if (id) {
      const { error: updateError } = await supabase.from('lineups').update(values).eq('id', id).eq('team_id', profile.team_id)
      if (updateError) { setError('No se pudo actualizar la alineación.'); setSaving(false); return }
    } else {
      const { data, error: insertError } = await supabase.from('lineups').insert(values).select('id').single()
      if (insertError || !data) { setError('No se pudo guardar la alineación. Revisa los permisos de entrenador.'); setSaving(false); return }
      id = data.id as string
      setEditingId(id)
    }
    if (editingId) {
      const { error: deleteError } = await supabase.from('lineup_players').delete().eq('lineup_id', id)
      if (deleteError) { setError('La alineación se guardó, pero no se pudieron reemplazar sus posiciones.'); setSaving(false); return }
    }
    const playerRows = [...placedStarters, ...bench.filter((slot) => slot.player_id)].map((slot) => ({
      lineup_id: id,
      team_id: profile.team_id,
      player_id: slot.player_id,
      slot_type: slot.slot_type,
      x: Math.round(slot.x * 100) / 100,
      y: Math.round(slot.y * 100) / 100,
      position_label: slot.label,
    }))
    const { error: playersError } = await supabase.from('lineup_players').insert(playerRows)
    if (playersError) setError('La alineación se creó, pero no se pudieron guardar todos los jugadores. Revisa las plazas duplicadas.')
    else setSuccess(nextPublished ? 'Alineación publicada para el equipo.' : 'Borrador guardado.')
    await loadData()
    setSaving(false)
  }

  async function deleteLineup(lineup: SavedLineup) {
    if (!supabase || !window.confirm(`¿Eliminar “${lineup.name}”? Esta acción no se puede deshacer.`)) return
    const { error: deleteError } = await supabase.from('lineups').delete().eq('id', lineup.id).eq('team_id', profile?.team_id)
    if (deleteError) setError('No se pudo eliminar la alineación.')
    else { if (editingId === lineup.id) resetEditor(); setSuccess('Alineación eliminada.'); await loadData() }
  }

  function addBenchSlot() {
    if (!availablePlayers.length) return
    setBench((current) => [...current, { x: 50, y: 50, label: 'Suplente', player_id: '', slot_type: 'bench' }])
  }

  if (loading) return <Card><LoadingState label="Cargando plantilla y táctica…" /></Card>

  return <div className="lineup-page">
    {error && <InlineMessage tone="error">{error}</InlineMessage>}
    {success && <InlineMessage tone="success">{success}</InlineMessage>}
    {isCoach ? (
      <div className="lineup-editor-grid">
        <div className="lineup-board-column">
          <Card className="pitch-card">
            <div className="pitch-card-header"><div><span className="eyebrow">EDITOR FÚTBOL 7</span><h2>{editingId ? 'Editar alineación' : 'Tu pizarra táctica'}</h2></div><Pill tone="lime">{formation}</Pill></div>
            <div className="formation-select"><SelectField label="Formación" value={formation} onChange={(event) => changeFormation(event.target.value)}>{Object.keys(FORMATIONS).map((option) => <option key={option} value={option}>{option}{option === '2-3-1' ? ' · Predeterminada (equilibrada)' : ''}</option>)}</SelectField></div>
            <div className="pitch-stage-wrap">
              <div className="field-stage" ref={stageRef} onPointerMove={moveToken} onPointerUp={() => { dragIndex.current = null }} onPointerCancel={() => { dragIndex.current = null }}>
                <FootballPitch />
                {slots.map((slot, index) => {
                  const player = players.find((item) => item.id === slot.player_id)
                  if (!player) return null
                  return <button key={`${index}-${slot.player_id}`} className="field-player" type="button" style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onPointerDown={(event) => startDrag(index, event)} aria-label={`Mover ${player.full_name}, dorsal ${player.jersey_number ?? 'sin dorsal'}`}>
                    <span className="player-token-number">{player.jersey_number ?? '·'}</span><span className="player-token-name">{player.full_name.split(' ')[0]}</span><Grip className="player-grip" size={11} />
                  </button>
                })}
              </div>
              <div className="pitch-caption"><Grip size={13} /> Arrastra a cada jugador para ajustar su posición</div>
            </div>
          </Card>
        </div>

        <div className="lineup-controls-column">
          <Card className="lineup-setup-card">
            <div className="section-head"><h2>Convocatoria</h2><span className="count-chip">{slots.filter((slot) => slot.player_id).length}/7 titulares</span></div>
            <Field label="Nombre de la alineación" value={name} maxLength={90} onChange={(event) => setName(event.target.value)} placeholder="Ej. Jornada 4 · inicio" />
            <SelectField label="Partido asociado" value={matchId} onChange={(event) => setMatchId(event.target.value)}><option value="">Sin partido asociado</option>{matches.map((item) => <option key={item.id} value={item.id}>{item.opponent} · {item.match_date}</option>)}</SelectField>
            <div className="slot-list">
              {slots.map((slot, index) => {
                const used = new Set([...slots.filter((_, otherIndex) => otherIndex !== index).map((item) => item.player_id), ...bench.map((item) => item.player_id)])
                const options = players.filter((player) => !used.has(player.id))
                return <div className="slot-row" key={`${formation}-${index}`}><span className="slot-number">{String(index + 1).padStart(2, '0')}</span><span className="slot-label">{slot.label}</span><select aria-label={`Jugador titular ${index + 1}`} value={slot.player_id} onChange={(event) => setSlots((current) => current.map((item, i) => i === index ? { ...item, player_id: event.target.value } : item))}><option value="">Seleccionar jugador</option>{options.map((player) => <option key={player.id} value={player.id}>#{player.jersey_number ?? '—'} · {player.full_name}</option>)}</select></div>
              })}
            </div>
            <div className="section-head bench-head"><h2>Suplentes</h2><button type="button" onClick={addBenchSlot} disabled={!availablePlayers.length}><Plus size={14} /> Añadir</button></div>
            {bench.length === 0 ? <div className="bench-empty">Aún no has añadido suplentes.</div> : <div className="slot-list">{bench.map((slot, index) => {
              const used = new Set([...slots.map((item) => item.player_id), ...bench.filter((_, otherIndex) => otherIndex !== index).map((item) => item.player_id)])
              return <div className="slot-row bench-row" key={`bench-${index}`}><span className="slot-number">S{index + 1}</span><select aria-label={`Jugador suplente ${index + 1}`} value={slot.player_id} onChange={(event) => setBench((current) => current.map((item, i) => i === index ? { ...item, player_id: event.target.value } : item))}><option value="">Seleccionar jugador</option>{players.filter((player) => !used.has(player.id)).map((player) => <option key={player.id} value={player.id}>#{player.jersey_number ?? '—'} · {player.full_name}</option>)}</select><button className="small-icon-action" aria-label="Quitar suplente" onClick={() => setBench((current) => current.filter((_, i) => i !== index))}><X size={15} /></button></div>
            })}</div>}
            <div className="lineup-actions">
              <Button variant="secondary" onClick={() => void saveLineup(false)} disabled={saving || !players.length}>
                {saving && !published ? 'Guardando…' : 'Guardar borrador'}
              </Button>
              <Button onClick={() => void saveLineup(true)} disabled={saving || !players.length}>
                {saving && published ? 'Publicando…' : <><Save size={16} /> Publicar equipo</>}
              </Button>
              {editingId && <Button variant="ghost" onClick={resetEditor}><X size={15} /> Nueva</Button>}
            </div>
            {!players.length && <InlineMessage tone="info"><Users size={14} /> Añade jugadores a la plantilla antes de diseñar la alineación.</InlineMessage>}
          </Card>
        </div>
      </div>
    ) : null}

    <div className="section-head saved-lineups-head"><h2>{isCoach ? 'Alineaciones guardadas' : 'Alineaciones del equipo'}</h2><span>{lineups.length}</span></div>
    {lineups.length ? <div className="saved-lineups-grid">{lineups.map((item) => <Card className="saved-lineup-card" key={item.id}>
      <div className="saved-lineup-top"><div className="saved-lineup-badge"><Users size={16} /></div><div><div className="saved-lineup-name">{item.name}</div><div className="saved-lineup-date">{formatDate(item.created_at.slice(0, 10), 'd MMM yyyy')}</div></div><Pill tone={item.published ? 'lime' : 'neutral'}>{item.published ? 'Publicada' : 'Borrador'}</Pill></div>
      <div className="saved-lineup-meta"><span>Formación <b>{item.formation}</b></span><span>{item.lineup_players?.filter((slot) => slot.slot_type === 'starter').length ?? 0} titulares</span></div>
      <SavedPitch lineup={item} />
      {item.lineup_players && <div className="saved-player-list">{item.lineup_players.filter((slot) => slot.slot_type === 'starter').map((slot) => <span key={slot.id || slot.player_id}>#{slot.players?.jersey_number ?? '—'} {slot.players?.full_name ?? 'Jugador'}</span>)}</div>}
      {isCoach && <div className="saved-lineup-actions"><Button variant="secondary" size="sm" onClick={() => editLineup(item)}><Pencil size={14} /> Editar</Button><Button variant="ghost" size="sm" onClick={() => void deleteLineup(item)}><Trash2 size={14} /> Eliminar</Button></div>}
    </Card>)}</div> : <Card><EmptyState icon={<CircleHelp size={19} />} title={isCoach ? 'Empieza con la primera alineación' : 'Todavía no hay alineaciones publicadas'} detail={isCoach ? 'Selecciona una formación, coloca a los titulares y guarda la pizarra.' : 'Cuando el entrenador publique una alineación aparecerá aquí.'} /></Card>}
  </div>
}
