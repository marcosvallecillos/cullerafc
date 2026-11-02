import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, MapPin, Megaphone, Plus } from 'lucide-react'
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
    month: format(date, 'MMM', { locale: es }).replace('.', ''),
    weekday: format(date, 'EEE', { locale: es }).replace('.', ''),
  }
}

export function HomePage() {
  const { profile } = useAuth()
  const [match, setMatch] = useState<MatchRecord | null>(null)
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
    const [matches, activities, lineups, notices] = await Promise.all([
      supabase.from('matches').select('*').eq('team_id', profile.team_id).eq('status', 'pending').or(matchWindow).order('match_date').order('start_time', { ascending: true, nullsFirst: false }).limit(1),
      supabase.from('activities').select('*').eq('team_id', profile.team_id).or(activityWindow).order('activity_date').order('start_time', { ascending: true, nullsFirst: false }).limit(1),
      supabase.from('lineups').select('*').eq('team_id', profile.team_id).eq('published', true).order('updated_at', { ascending: false }).limit(1),
      supabase.from('announcements').select('*').eq('team_id', profile.team_id).order('created_at', { ascending: false }).limit(3),
    ])
    const failed = [matches.error, activities.error, lineups.error, notices.error].find(Boolean)
    if (failed) setError('No se pudo actualizar el inicio. Comprueba que el esquema de Supabase esté aplicado.')
    setMatch((matches.data?.[0] as MatchRecord | undefined) ?? null)
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

  const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const greeting = profile?.full_name.split(' ')[0] || 'equipo'
  const isCoach = profile?.role === 'coach'
  const matchDay = match ? dayParts(match.match_date) : null
  const activityDay = activity ? dayParts(activity.activity_date) : null

  return (
    <>
      <PageHeading
        eyebrow={today}
        title={`Hola, ${greeting}`}
        description={isCoach ? 'Partido, convocatoria y avisos.' : 'Tu convocatoria y avisos del club.'}
        action={isCoach ? <Button variant="secondary" size="sm" onClick={() => setShowNotice((value) => !value)}><Plus size={15} /> Aviso</Button> : undefined}
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

      <div className="home-layout">
        <div className="home-primary">
          <div className="section-head">
            <h2>Próximas citas</h2>
            <Link to="/activities">Calendario <ArrowRight size={13} /></Link>
          </div>

          {loading ? (
            <Card className="home-block"><LoadingState label="Cargando…" /></Card>
          ) : (
            <div className="home-stack">
              <Card className={match && matchDay ? 'home-row' : 'home-row home-row-empty'}>
                {match && matchDay ? (
                  <>
                    <div className="home-date">
                      <span>{matchDay.weekday}</span>
                      <strong>{matchDay.day}</strong>
                      <span>{matchDay.month}</span>
                    </div>
                    <div className="home-row-body">
                      <div className="home-row-label">Partido</div>
                      <h3>
                        Cullera FC <i>vs</i> {match.opponent}
                      </h3>
                      <ul className="home-meta">
                        <li><CalendarDays size={13} />{formatDate(match.match_date, "EEEE d 'de' MMMM")}</li>
                        <li>{formatClock(match.start_time)}</li>
                        {match.location && <li><MapPin size={13} />{match.location}</li>}
                      </ul>
                      <Link to="/matches" className="inline-link">Detalle <ArrowRight size={13} /></Link>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Sin partido" detail="Cuando haya fecha, saldrá aquí." />
                )}
              </Card>

              <Card className={activity && activityDay ? 'home-row' : 'home-row home-row-empty'}>
                {activity && activityDay ? (
                  <>
                    <div className="home-date home-date-muted">
                      <span>{activityDay.weekday}</span>
                      <strong>{activityDay.day}</strong>
                      <span>{activityDay.month}</span>
                    </div>
                    <div className="home-row-body">
                      <div className="home-row-label">{activityLabels[activity.activity_type]}</div>
                      <h3>{activity.title}</h3>
                      <ul className="home-meta">
                        <li>{formatClock(activity.start_time)}</li>
                        {activity.location && <li><MapPin size={13} />{activity.location}</li>}
                      </ul>
                      {!isCoach && (
                        <div className="home-rsvp-status">
                          <span>Asistencia</span>
                          <Pill tone={activityResponse === 'yes' ? 'lime' : activityResponse === 'no' ? 'red' : 'neutral'}>
                            {activityResponse === 'yes' ? 'Confirmada' : activityResponse === 'no' ? 'No asisto' : 'Pendiente'}
                          </Pill>
                        </div>
                      )}
                      <Link to="/activities" className="inline-link">Detalle <ArrowRight size={13} /></Link>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Sin actividad" detail="La próxima convocatoria aparecerá aquí." />
                )}
              </Card>
            </div>
          )}

          <div className="section-head">
            <h2>Alineación</h2>
            <Link to="/tactics">Táctica <ArrowRight size={13} /></Link>
          </div>

          <Card className="home-lineup">
            {lineup ? (
              <div className="home-lineup-body">
                <div>
                  <div className="home-row-label">Publicada</div>
                  <h3>{lineup.name}</h3>
                  <p>Formación {lineup.formation}</p>
                </div>
                <Link to="/tactics" className="inline-link">Ver <ArrowRight size={13} /></Link>
              </div>
            ) : (
              <EmptyState icon={<ClipboardList size={18} />} title="Sin alineación publicada" detail="Cuando el entrenador la publique, la verás aquí." />
            )}
          </Card>
        </div>

        <aside className="home-aside">
          <Card className="home-links">
            <div className="home-row-label">{isCoach ? 'Gestión' : 'Accesos'}</div>
            <nav>
              {isCoach ? (
                <>
                  <Link to="/tactics">Alineación <ArrowRight size={14} /></Link>
                  <Link to="/roster">Plantilla <ArrowRight size={14} /></Link>
                  <Link to="/activities">Actividades <ArrowRight size={14} /></Link>
                  <Link to="/matches">Partidos <ArrowRight size={14} /></Link>
                </>
              ) : (
                <>
                  <Link to="/activities">Asistencia <ArrowRight size={14} /></Link>
                  <Link to="/tactics">Pizarra <ArrowRight size={14} /></Link>
                  <Link to="/matches">Partidos <ArrowRight size={14} /></Link>
                </>
              )}
            </nav>
          </Card>

          <div className="section-head">
            <h2>Avisos</h2>
          </div>

          {loading ? (
            <Card className="home-block"><LoadingState label="Cargando…" /></Card>
          ) : announcements.length ? (
            <div className="home-notices">
              {announcements.map((item) => (
                <article className="home-notice" key={item.id}>
                  <time dateTime={item.created_at}>{format(parseISO(item.created_at), "d MMM · HH:mm", { locale: es })}</time>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          ) : (
            <Card className="home-block">
              <EmptyState icon={<Megaphone size={18} />} title="Sin avisos" detail="Los avisos del entrenador saldrán aquí." />
            </Card>
          )}
        </aside>
      </div>
    </>
  )
}
