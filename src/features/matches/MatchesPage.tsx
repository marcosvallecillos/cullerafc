import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowRight, CalendarDays, Check, Clock3, MapPin, Pencil, Plus, Shield, Trash2, Trophy, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, PageHeading, Pill, SelectField } from '../../components/ui'
import { formatClock, formatDate, formatShortDate } from '../../lib/format'
import { supabase } from '../../lib/supabase/client'
import type { Lineup, MatchRecord } from '../../lib/types'

interface MatchForm { opponent: string; match_date: string; start_time: string; location: string; round: string; home_score: string; away_score: string; status: 'pending' | 'finished' }
const emptyForm = (): MatchForm => ({ opponent: '', match_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', location: '', round: '', home_score: '', away_score: '', status: 'pending' })
type Filter = 'upcoming' | 'finished' | 'all'

export function MatchesPage() {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach'
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MatchRecord | null>(null)
  const [form, setForm] = useState<MatchForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    if (!supabase || !profile) return
    setLoading(true)
    const [matchResult, lineupResult] = await Promise.all([
      supabase.from('matches').select('*').eq('team_id', profile.team_id).order('match_date', { ascending: false }),
      supabase.from('lineups').select('id, team_id, match_id, name, formation, published, created_at').eq('team_id', profile.team_id),
    ])
    if (matchResult.error || lineupResult.error) setError('No se pudieron cargar los partidos. Comprueba el esquema de Supabase.')
    setMatches((matchResult.data as MatchRecord[] | null) ?? [])
    setLineups((lineupResult.data as Lineup[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.team_id])

  const visibleMatches = useMemo(() => {
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm:ss')
    const isUpcoming = (item: MatchRecord) => item.match_date > today || (item.match_date === today && (!item.start_time || item.start_time >= currentTime))
    if (filter === 'upcoming') return matches.filter((item) => item.status === 'pending' && isUpcoming(item)).sort((a, b) => a.match_date.localeCompare(b.match_date) || (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99'))
    if (filter === 'finished') return matches.filter((item) => item.status === 'finished' || item.match_date < today || (item.match_date === today && Boolean(item.start_time) && item.start_time! < currentTime))
    return [...matches].sort((a, b) => a.match_date.localeCompare(b.match_date) || (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99'))
  }, [matches, filter])

  function openCreate() { setEditing(null); setForm(emptyForm()); setShowForm(true); setError(null); setSuccess(null) }
  function openEdit(match: MatchRecord) {
    setEditing(match)
    setForm({ opponent: match.opponent, match_date: match.match_date, start_time: match.start_time?.slice(0, 5) ?? '', location: match.location ?? '', round: match.round ?? '', home_score: match.home_score?.toString() ?? '', away_score: match.away_score?.toString() ?? '', status: match.status })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile) return
    if (!form.opponent.trim()) { setError('Escribe el nombre del equipo rival.'); return }
    const home = form.home_score.trim() === '' ? null : Number(form.home_score)
    const away = form.away_score.trim() === '' ? null : Number(form.away_score)
    if ([home, away].some((score) => score !== null && (!Number.isInteger(score) || score < 0 || score > 99))) { setError('Los resultados deben ser números enteros entre 0 y 99.'); return }
    if (form.status === 'finished' && (home === null || away === null)) { setError('Registra ambos goles para marcar el partido como finalizado.'); return }
    setSaving(true)
    setError(null)
    const values = { team_id: profile.team_id, created_by: profile.id, opponent: form.opponent.trim(), match_date: form.match_date, start_time: form.start_time || null, location: form.location.trim() || null, round: form.round.trim() || null, home_score: home, away_score: away, status: form.status }
    const response = editing ? await supabase.from('matches').update(values).eq('id', editing.id).eq('team_id', profile.team_id) : await supabase.from('matches').insert(values)
    if (response.error) setError('No se pudo guardar el partido. Comprueba los permisos de entrenador.')
    else { setSuccess(editing ? 'Partido actualizado.' : 'Partido añadido al calendario.'); setShowForm(false); await load() }
    setSaving(false)
  }

  async function deleteMatch(match: MatchRecord) {
    if (!supabase || !window.confirm(`¿Eliminar el partido contra ${match.opponent}?`)) return
    const { error: deleteError } = await supabase.from('matches').delete().eq('id', match.id).eq('team_id', profile?.team_id)
    if (deleteError) setError('No se pudo eliminar el partido.')
    else { setSuccess('Partido eliminado.'); await load() }
  }

  function associatedLineup(matchId: string) { return lineups.find((item) => item.match_id === matchId && item.published) }

  return <>
    <PageHeading eyebrow="COMPETICIÓN · CULLERA FC" title="Día de partido." description="Calendario, resultados y memoria de la temporada." action={isCoach ? <Button onClick={openCreate}><Plus size={16} /> Añadir partido</Button> : undefined} />
    {error && <InlineMessage tone="error">{error}</InlineMessage>}{success && <InlineMessage tone="success">{success}</InlineMessage>}
    {showForm && isCoach && <Card className="match-form-card"><form onSubmit={save}>
      <div className="section-head"><h2>{editing ? 'Editar partido' : 'Nuevo partido'}</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setShowForm(false)}><X size={17} /></button></div>
      <div className="match-form-grid"><Field label="Equipo rival" required autoFocus maxLength={110} value={form.opponent} onChange={(event) => setForm((current) => ({ ...current, opponent: event.target.value }))} placeholder="Nombre del rival" /><Field label="Jornada" maxLength={50} value={form.round} onChange={(event) => setForm((current) => ({ ...current, round: event.target.value }))} placeholder="Ej. Jornada 6" /><Field label="Fecha" type="date" required value={form.match_date} onChange={(event) => setForm((current) => ({ ...current, match_date: event.target.value }))} /><Field label="Hora" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} /><Field label="Ubicación" maxLength={180} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Campo / dirección" /><SelectField label="Estado" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MatchForm['status'] }))}><option value="pending">Pendiente</option><option value="finished">Finalizado</option></SelectField><Field label="Goles Cullera FC" type="number" min="0" max="99" value={form.home_score} onChange={(event) => setForm((current) => ({ ...current, home_score: event.target.value }))} placeholder="—" /><Field label="Goles rival" type="number" min="0" max="99" value={form.away_score} onChange={(event) => setForm((current) => ({ ...current, away_score: event.target.value }))} placeholder="—" /></div>
      <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : <><Check size={15} /> {editing ? 'Guardar cambios' : 'Añadir partido'}</>}</Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button></div>
    </form></Card>}

    <div className="match-filter-tabs" role="tablist" aria-label="Filtrar partidos">{([['upcoming', 'Próximos'], ['finished', 'Resultados'], ['all', 'Todos']] as const).map(([key, label]) => <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>{label}<span>{key === 'upcoming' ? matches.filter((item) => item.status === 'pending' && item.match_date >= format(new Date(), 'yyyy-MM-dd')).length : key === 'finished' ? matches.filter((item) => item.status === 'finished' || item.match_date < format(new Date(), 'yyyy-MM-dd')).length : matches.length}</span></button>)}</div>
    {loading ? <Card><LoadingState label="Cargando calendario de partidos…" /></Card> : visibleMatches.length ? <div className="matches-list">{visibleMatches.map((match) => {
      const lineup = associatedLineup(match.id)
      const hasScore = match.home_score !== null && match.away_score !== null
      const resultTone = hasScore && match.home_score! > match.away_score! ? 'lime' : hasScore && match.home_score === match.away_score ? 'neutral' : 'red'
      return <Card className={`match-record ${match.status === 'finished' ? 'match-finished' : ''}`} key={match.id}>
        <div className="match-record-date"><strong>{formatShortDate(match.match_date)}</strong><span>{format(parseDateSafe(match.match_date), 'yyyy', { locale: es })}</span><Pill tone={match.status === 'finished' ? 'neutral' : 'lime'}>{match.status === 'finished' ? 'Finalizado' : 'Pendiente'}</Pill></div>
        <div className="match-record-main"><div className="match-round">{match.round || 'PARTIDO DE LIGA'}</div><h3><span>Cullera FC</span><i>vs</i><span>{match.opponent}</span></h3><div className="match-record-details"><span><CalendarDays size={13} />{formatDate(match.match_date, 'EEEE d MMMM')}</span><span><Clock3 size={13} />{formatClock(match.start_time)}</span>{match.location && <span><MapPin size={13} />{match.location}</span>}</div>{lineup && <Link to="/tactics" className="match-lineup-link"><Shield size={13} /> Alineación: {lineup.name} <ArrowRight size={12} /></Link>}</div>
        <div className="match-record-score">{hasScore ? <><span className="score-label">RESULTADO</span><Pill tone={resultTone}>{match.home_score} — {match.away_score}</Pill></> : <><span className="score-label">{match.status === 'finished' ? 'SIN RESULTADO' : 'PRÓXIMO'}</span><div className="score-placeholder"><Trophy size={15} /></div></>}</div>
        {isCoach && <div className="match-record-actions"><button aria-label="Editar partido" onClick={() => openEdit(match)}><Pencil size={15} /></button><button aria-label="Eliminar partido" onClick={() => void deleteMatch(match)}><Trash2 size={15} /></button></div>}
      </Card>
    })}</div> : <Card><EmptyState icon={<Shield size={19} />} title={filter === 'upcoming' ? 'No hay partidos próximos' : 'No hay partidos en esta lista'} detail={isCoach ? 'Añade el próximo encuentro para organizar la convocatoria.' : 'Los partidos aparecerán aquí cuando el entrenador los añada.'} /></Card>}
  </>
}

function parseDateSafe(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
