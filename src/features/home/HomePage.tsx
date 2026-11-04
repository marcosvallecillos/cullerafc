import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CalendarDays, Clock, LayoutGrid, MapPin, Megaphone,
  Plus, Shield, SquarePen, Trophy, Users, Layers, ClipboardList,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, PageHeading, Pill, TextareaField } from '../../components/ui'
import { supabase } from '../../lib/supabase/client'
import type { Activity, Announcement, AttendanceResponse, Lineup, MatchRecord } from '../../lib/types'
import { activityLabels, formatClock, formatDate } from '../../lib/format'

function dayParts(isoDate: string) {
  const date = parseISO(isoDate)
  return {
    day: format(date, 'd'),
    month: format(date, 'MMM', { locale: es }).replace('.', '').toUpperCase(),
    weekday: format(date, 'EEE', { locale: es }).replace('.', '').toUpperCase(),
  }
}

function formationBreakdown(formation: string) {
  const parts = formation.split('-').map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
  if (parts.length >= 3) {
    return {
      def: parts[0],
      med: parts.slice(1, -1).reduce((a, b) => a + b, 0),
      del: parts[parts.length - 1],
      total: parts.reduce((a, b) => a + b, 0) + 1,
    }
  }
  return null
}

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function HomePage() {
  const { profile } = useAuth()
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [activity, setActivity] = useState<Activity | null>(null)
  const [activityResponse, setActivityResponse] = useState<AttendanceResponse | null>(null)
  const [lineup, setLineup] = useState<Lineup | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNotice, setShowNotice] = useState(false)
  const [noticeTitle, setNoticeTitle] = useState('')
  const [noticeBody, setNoticeBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!supabase || !profile) return
    setLoading(true)
    setError(null)
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm:ss')
    const matchWindow = `match_date.gt.${today},and(match_date.eq.${today},start_time.gte.${currentTime}),and(match_date.eq.${today},start_time.is.null)`
    const activityWindow = `activity_date.gt.${today},and(activity_date.eq.${today},start_time.gte.${currentTime}),and(activity_date.eq.${today},start_time.is.null)`
    const [matchResult, activities, lineups, notices] = await Promise.all([
      supabase.from('matches').select('*').eq('team_id', profile.team_id).eq('status', 'pending').or(matchWindow).order('match_date').order('start_time', { ascending: true, nullsFirst: false }).limit(3),
      supabase.from('activities').select('*').eq('team_id', profile.team_id).or(activityWindow).order('activity_date').order('start_time', { ascending: true, nullsFirst: false }).limit(1),
      supabase.from('lineups').select('*').eq('team_id', profile.team_id).eq('published', true).order('updated_at', { ascending: false }).limit(1),
      supabase.from('announcements').select('*').eq('team_id', profile.team_id).order('created_at', { ascending: false }).limit(3),
    ])
    const failed = [matchResult.error, activities.error, lineups.error, notices.error].find(Boolean)
    if (failed) setError('No se pudo actualizar el inicio. Comprueba que el esquema de Supabase esté aplicado.')
    setMatches((matchResult.data as MatchRecord[] | null) ?? [])
    const nextActivity = (activities.data?.[0] as Activity | undefined) ?? null
    setActivity(nextActivity)
    if (profile.role === 'player' && nextActivity) {
      const { data: response, error: responseError } = await supabase.from('activity_attendance').select('response').eq('activity_id', nextActivity.id).eq('profile_id', profile.id).maybeSingle()
      if (responseError) setError('No se pudo consultar tu respuesta a la convocatoria.')
      setActivityResponse((response?.response as AttendanceResponse | undefined) ?? null)
    } else setActivityResponse(null)
    setLineup((lineups.data?.[0] as Lineup | undefined) ?? null)
    setAnnouncements((notices.data as Announcement[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.team_id])

  async function publishNotice(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile || !noticeTitle.trim() || !noticeBody.trim()) return
    setSaving(true)
    const { error: insertError } = await supabase.from('announcements').insert({ team_id: profile.team_id, created_by: profile.id, title: noticeTitle.trim(), body: noticeBody.trim() })
    if (insertError) setError('No se pudo publicar el aviso. Revisa los permisos de entrenador y la migración.')
    else {
      setNoticeTitle('')
      setNoticeBody('')
      setShowNotice(false)
      await load()
    }
    setSaving(false)
  }

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es }).toUpperCase()
  const isCoach = profile?.role === 'coach'
  const match = matches[0] ?? null
  const matchDay = match ? dayParts(match.match_date) : null
  const activityDay = activity ? dayParts(activity.activity_date) : null
  const scheme = lineup ? formationBreakdown(lineup.formation) : null

  const links = isCoach
    ? [
        { to: '/tactics', label: 'Alineación', Icon: LayoutGrid },
        { to: '/roster', label: 'Plantilla de jugadores', Icon: Users },
        { to: '/activities', label: 'Actividades y sesiones', Icon: CalendarDays },
        { to: '/matches', label: 'Calendario de partidos', Icon: Shield },
      ]
    : [
        { to: '/activities', label: 'Asistencia', Icon: CalendarDays },
        { to: '/tactics', label: 'Pizarra', Icon: LayoutGrid },
        { to: '/matches', label: 'Partidos', Icon: Shield },
      ]

  return (
    <div className="hm-page">
      <PageHeading
        eyebrow={today}
        title={isCoach ? 'Hola, entrenador' : `Hola, ${profile?.full_name.split(' ')[0] || 'equipo'}`}
        description={isCoach
          ? 'Partido en preparación, convocatoria activa y avisos del cuerpo técnico.'
          : 'Tu convocatoria, alineación y avisos del club.'}
        action={isCoach ? (
          <div className="hm-heading-actions">
            <Button variant="secondary" size="sm" onClick={() => setShowNotice((value) => !value)}><Plus size={15} /> Nuevo aviso</Button>
            <Link to="/tactics" className="button button-primary button-sm"><SquarePen size={15} /> Pizarra rápida</Link>
          </div>
        ) : undefined}
      />

      {error && <InlineMessage tone="error">{error}</InlineMessage>}

      {showNotice && (
        <Card className="notice-composer">
          <form onSubmit={publishNotice}>
            <div className="section-head">
              <h2>Nuevo aviso</h2>
              <button type="button" onClick={() => setShowNotice(false)}>Cancelar</button>
            </div>
            <Field label="Título" maxLength={90} required value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Asunto" />
            <TextareaField label="Mensaje" required maxLength={700} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Texto del aviso" />
            <Button type="submit" disabled={saving}>{saving ? 'Publicando…' : 'Publicar'}<ArrowRight size={15} /></Button>
          </form>
        </Card>
      )}

      {/* HERO a todo el ancho */}
      {loading ? (
        <Card className="hm-block"><LoadingState label="Cargando…" /></Card>
      ) : (
        <section className={`hm-hero ${match ? '' : 'is-empty'}`}>
          {match && matchDay ? (
            <>
              <div className="hm-hero-pitch" aria-hidden="true" />
              <div className="hm-hero-grid">
                <div className="hm-hero-when">
                  <div className="hm-datebox">
                    <span>{matchDay.weekday}</span>
                    <strong>{matchDay.day}</strong>
                    <span>{matchDay.month}</span>
                  </div>
                  <div className="hm-when-copy">
                    <span className="hm-chip">
                      <Trophy size={11} />
                      {match.round ? `${match.round} · Liga regular` : 'Próximo partido'}
                    </span>
                    <ul className="hm-meta hm-meta-sm">
                      <li><Clock size={12} />{formatClock(match.start_time)} H</li>
                      {match.location && <li><span className="hm-dot" /><MapPin size={12} />{match.location}</li>}
                    </ul>
                  </div>
                </div>

                <div className="hm-teams">
                  <div className="hm-team">
                    <span className="hm-crest hm-crest-home"><Shield size={16} /></span>
                    <small>Local</small>
                    <strong>Cullera FC</strong>
                  </div>
                  <span className="hm-vs">VS</span>
                  <div className="hm-team">
                    <span className="hm-crest"><Shield size={16} /></span>
                    <small>Visitante</small>
                    <strong>{match.opponent}</strong>
                  </div>
                </div>

                <div className="hm-hero-cta">
                  <span className="hm-status"><i />Pendiente</span>
                  <Link to="/tactics" className="button button-primary button-sm">
                    <Users size={14} /> Convocatoria & alineación <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="Sin partido programado" detail="Cuando haya fecha, el próximo rival aparecerá aquí." />
          )}
        </section>
      )}

      <div className="hm-layout">
        <div className="hm-primary">
          {/* PRÓXIMAS CITAS */}
          <div className="hm-head">
            <h2><CalendarDays size={16} /> Próximas citas</h2>
            <Link to="/activities">Ver calendario <ArrowRight size={13} /></Link>
          </div>

          {loading ? (
            <Card className="hm-block"><LoadingState label="Cargando…" /></Card>
          ) : (
            <div className="hm-stack">
              {matches.length ? matches.slice(0, 1).map((item) => {
                const parts = dayParts(item.match_date)
                return (
                  <Card className="hm-row" key={item.id}>
                    <div className="hm-date">
                      <span>{parts.weekday}</span>
                      <strong>{parts.day}</strong>
                      <span>{parts.month}</span>
                    </div>
                    <div className="hm-row-body">
                      <div className="hm-tags">
                        <span className="hm-tag hm-tag-lime">Partido oficial</span>
                        {item.round && <span className="hm-tag-text">{item.round}</span>}
                      </div>
                      <h3>Cullera FC <i>vs</i> {item.opponent}</h3>
                      <ul className="hm-meta">
                        <li><CalendarDays size={12} />{cap(formatDate(item.match_date, "EEEE d 'de' MMMM"))}</li>
                        <li><Clock size={12} />{formatClock(item.start_time)}</li>
                        {item.location && <li><MapPin size={12} />{item.location}</li>}
                      </ul>
                    </div>
                    <Link to="/matches" className="hm-detail">Detalle <ArrowRight size={12} /></Link>
                  </Card>
                )
              }) : (
                <Card className="hm-row hm-row-empty"><EmptyState title="Sin partido" detail="Cuando haya fecha, saldrá aquí." /></Card>
              )}

              <Card className={activity && activityDay ? 'hm-row' : 'hm-row hm-row-empty'}>
                {activity && activityDay ? (
                  <>
                    <div className="hm-date">
                      <span>{activityDay.weekday}</span>
                      <strong>{activityDay.day}</strong>
                      <span>{activityDay.month}</span>
                    </div>
                    <div className="hm-row-body">
                      <div className="hm-tags">
                        <span className={`hm-tag ${activity.activity_type === 'friendly' ? 'hm-tag-blue' : 'hm-tag-lime'}`}>
                          {activityLabels[activity.activity_type]}
                        </span>
                      </div>
                      <h3>{activity.title}</h3>
                      <ul className="hm-meta">
                        <li><Clock size={12} />{formatClock(activity.start_time)}</li>
                        {activity.location && <li><MapPin size={12} />{activity.location}</li>}
                      </ul>
                      {!isCoach && (
                        <div className="hm-rsvp">
                          <span>Asistencia</span>
                          <Pill tone={activityResponse === 'yes' ? 'lime' : activityResponse === 'no' ? 'red' : 'neutral'}>
                            {activityResponse === 'yes' ? 'Confirmada' : activityResponse === 'no' ? 'No asisto' : 'Pendiente'}
                          </Pill>
                        </div>
                      )}
                    </div>
                    <Link to="/activities" className="hm-detail hm-detail-muted">Detalle <ArrowRight size={12} /></Link>
                  </>
                ) : <EmptyState title="Sin actividad" detail="La próxima convocatoria aparecerá aquí." />}
              </Card>
            </div>
          )}

          {/* ALINEACIÓN */}
          <div className="hm-head hm-head-gap">
            <h2><ClipboardList size={16} /> Alineación & táctica</h2>
            <Link to="/tactics">Ir a pizarra táctica <ArrowRight size={13} /></Link>
          </div>

          <Card className="hm-lineup">
            {lineup ? (
              <>
                <span className="hm-lineup-icon"><Layers size={20} /></span>
                <div className="hm-lineup-body">
                  <span className="hm-published"><i />Publicada</span>
                  <h3>{lineup.name}</h3>
                  <p>
                    Esquema táctico: <b>{lineup.formation}</b> [Fútbol 7]
                    {scheme && <> · {scheme.total} titulares definidos</>}
                  </p>
                </div>
                {scheme && (
                  <div className="hm-scheme">
                    <span>DEF: <b>{scheme.def}</b></span>
                    <span>MED: <b>{scheme.med}</b></span>
                    <span>DEL: <b>{scheme.del}</b></span>
                  </div>
                )}
                <Link to="/tactics" className="hm-detail hm-detail-strong">Ver pizarra <ArrowRight size={13} /></Link>
              </>
            ) : (
              <EmptyState icon={<ClipboardList size={18} />} title="Sin alineación publicada" detail="Cuando el entrenador la publique, la verás aquí." />
            )}
          </Card>
        </div>

        <aside className="hm-aside">
          <Card className="hm-links">
            <div className="hm-aside-head">
              <span>{isCoach ? 'Gestión del equipo' : 'Accesos'}</span>
              <em>{links.length} accesos</em>
            </div>
            <nav>
              {links.map(({ to, label, Icon }) => (
                <Link to={to} key={to}><Icon size={15} /><span>{label}</span><ArrowRight size={14} /></Link>
              ))}
            </nav>
          </Card>

          <Card className="hm-notices">
            <div className="hm-aside-head hm-aside-head-title">
              <h2>Avisos</h2>
              <em>Vestuario</em>
            </div>
            {loading ? (
              <LoadingState label="Cargando…" />
            ) : announcements.length ? (
              <div className="hm-notice-list">
                {announcements.map((item) => (
                  <article className="hm-notice" key={item.id}>
                    <time dateTime={item.created_at}>{format(parseISO(item.created_at), 'd MMM · HH:mm', { locale: es })}</time>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="hm-notices-empty">
                <span className="hm-notices-icon"><Megaphone size={20} /></span>
                <strong>Sin avisos urgentes</strong>
                <p>Los avisos y mensajes del entrenador para la plantilla saldrán aquí.</p>
              </div>
            )}
            {isCoach && (
              <button type="button" className="hm-publish" onClick={() => setShowNotice(true)}>
                <Plus size={14} /> Publicar nota al vestuario
              </button>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}