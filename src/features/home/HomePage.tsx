import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, Bell, CalendarDays, ClipboardList, MapPin, Megaphone, Plus, Shield, Sparkles, Users } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, PageHeading, Pill, TextareaField } from '../../components/ui'
import { supabase } from '../../lib/supabase/client'
import type { Activity, Announcement, AttendanceResponse, Lineup, MatchRecord } from '../../lib/types'
import { activityLabels, formatClock, formatDate, formatShortDate } from '../../lib/format'

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

  return (
    <>
      <PageHeading
        eyebrow={today}
        title={`Hola, ${greeting}.`}
        description={profile?.role === 'coach' ? 'Prepara la convocatoria, la pizarra y la semana del equipo.' : 'Tus próximas citas, avisos y alineaciones en un solo lugar.'}
        action={profile?.role === 'coach' ? <Button variant="secondary" size="sm" onClick={() => setShowNotice((value) => !value)}><Plus size={15} /> Aviso</Button> : undefined}
      />
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      {showNotice && (
        <Card className="notice-composer">
          <form onSubmit={publishNotice}>
            <div className="section-head"><h2>Nuevo aviso</h2><button type="button" onClick={() => setShowNotice(false)}>Cancelar</button></div>
            <Field label="Título" maxLength={90} required value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="Información para el equipo" />
            <TextareaField label="Mensaje" required maxLength={700} value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="Escribe los detalles…" />
            <Button type="submit" disabled={saving}>{saving ? 'Publicando…' : 'Publicar aviso'}<ArrowRight size={15} /></Button>
          </form>
        </Card>
      )}
      <section className="dashboard-hero">
        <div className="hero-copy">
          <div className="hero-label"><span className="hero-pip" /> {profile?.role === 'coach' ? 'PREPARACIÓN DEL EQUIPO' : 'TU SEMANA · CULLERA FC'}</div>
          <h2>{profile?.role === 'coach' ? <>Prepara al equipo<br /><em>para el reto.</em></> : <>Tu próximo reto<br /><em>empieza aquí.</em></>}</h2>
          <p>{profile?.role === 'coach' ? 'Convocatoria, pizarra y calendario en un solo lugar.' : 'Todo lo que necesitas para llegar preparado.'}</p>
          <Link to={profile?.role === 'coach' ? '/tactics' : '/activities'} className="hero-link">{profile?.role === 'coach' ? 'Diseñar alineación' : 'Ver convocatoria'} <ArrowRight size={16} /></Link>
        </div>
        <div className="hero-mark"><div className="hero-ring hero-ring-a" /><div className="hero-ring hero-ring-b" /><img src="/cullera-mark.svg" alt="Escudo de Cullera FC" /></div>
        <div className="hero-number">CFC <span>· 7</span></div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main-col">
          <div className="section-head"><h2>{profile?.role === 'coach' ? 'Agenda del equipo' : 'Tu agenda'}</h2><Link to="/activities">Ver calendario <ArrowRight size={13} /></Link></div>
          {loading ? <Card><LoadingState label="Buscando próximas citas…" /></Card> : (
            <div className="event-stack">
              <Card className="event-card match-card">
                <div className="event-marker"><Shield size={17} /></div>
                <div className="event-main">
                  <div className="event-topline"><span className="eyebrow">PRÓXIMO PARTIDO</span>{match && <span className="event-date-chip">{formatShortDate(match.match_date)}</span>}</div>
                  {match ? (
                    <>
                      <h3>Cullera FC <span>vs</span> {match.opponent}</h3>
                      <div className="event-details">
                        <span><CalendarDays size={14} />{formatDate(match.match_date, "EEEE d 'de' MMMM")}</span>
                        <span><span className="tiny-clock" />{formatClock(match.start_time)}</span>
                        {match.location && <span><MapPin size={14} />{match.location}</span>}
                      </div>
                      <Link to="/matches" className="inline-link">Ver partido <ArrowRight size={13} /></Link>
                    </>
                  ) : <EmptyState title="Sin partido programado" detail="Cuando el entrenador añada un partido aparecerá aquí." />}
                </div>
              </Card>
              <Card className="event-card activity-card">
                <div className="event-marker"><CalendarDays size={17} /></div>
                <div className="event-main">
                  <div className="event-topline"><span className="eyebrow">PRÓXIMA ACTIVIDAD</span>{activity && <span className="event-date-chip lime-chip">{formatShortDate(activity.activity_date)}</span>}</div>
                  {activity ? (
                    <>
                      <h3>{activity.title}</h3>
                      <div className="event-details">
                        <span><Sparkles size={14} />{activityLabels[activity.activity_type]}</span>
                        <span><span className="tiny-clock" />{formatClock(activity.start_time)}</span>
                        {activity.location && <span><MapPin size={14} />{activity.location}</span>}
                      </div>
                      {profile?.role === 'player' && <div className="home-rsvp-status"><span>Tu respuesta</span><Pill tone={activityResponse === 'yes' ? 'lime' : activityResponse === 'no' ? 'red' : 'neutral'}>{activityResponse === 'yes' ? 'Confirmada' : activityResponse === 'no' ? 'No puedes asistir' : 'Pendiente de confirmar'}</Pill></div>}
                      <Link to="/activities" className="inline-link">Ver actividad <ArrowRight size={13} /></Link>
                    </>
                  ) : <EmptyState title="Sin actividad programada" detail="Las próximas actividades estarán visibles en este espacio." />}
                </div>
              </Card>
            </div>
          )}
          <div className="section-head"><h2>Última alineación</h2><Link to="/tactics">Abrir táctica <ArrowRight size={13} /></Link></div>
          <Card className="lineup-teaser">
            {lineup ? (
              <div className="lineup-teaser-inner">
                <div className="mini-pitch"><div className="mini-pitch-circle" />{Array.from({ length: 7 }, (_, index) => <div className={`mini-pitch-mark m${index + 1}`} key={index} />)}</div>
                <div className="lineup-teaser-copy"><span className="eyebrow">PUBLICADA</span><h3>{lineup.name}</h3><p>Formación <b>{lineup.formation}</b></p><Link to="/tactics" className="inline-link">Ver alineación <ArrowRight size={13} /></Link></div>
              </div>
            ) : <EmptyState icon={<ClipboardList size={19} />} title="Aún no hay alineación publicada" detail="La alineación del próximo partido aparecerá aquí cuando el entrenador la publique." />}
          </Card>
        </div>

        <aside className="dashboard-side-col">
          <Card className="week-card">
            <div className="week-card-top"><div><span className="eyebrow">{profile?.role === 'coach' ? 'PANEL DEL ENTRENADOR' : 'TU SEMANA'}</span><h3>{profile?.role === 'coach' ? <>El equipo,<br />en movimiento.</> : <>Tu equipo,<br />a punto.</>}</h3></div><div className="week-icon"><ArrowDownRight size={19} /></div></div>
            <div className="week-date"><CalendarDays size={15} />{format(new Date(), 'd MMM', { locale: es })} — {format(addDays(new Date(), 6), 'd MMM', { locale: es })}</div>
            <div className="week-links">{profile?.role === 'coach' ? <><Link to="/tactics">Preparar alineación <ArrowRight size={14} /></Link><Link to="/roster">Gestionar plantilla <ArrowRight size={14} /></Link><Link to="/activities">Organizar actividad <ArrowRight size={14} /></Link></> : <><Link to="/activities">Confirmar asistencia <ArrowRight size={14} /></Link><Link to="/tactics">Consultar pizarra <ArrowRight size={14} /></Link><Link to="/matches">Ver partidos <ArrowRight size={14} /></Link></>}</div>
          </Card>
          <div className="section-head announcement-head"><h2>Avisos del equipo</h2><Bell size={16} /></div>
          {loading ? <Card><LoadingState label="Cargando avisos…" /></Card> : announcements.length ? (
            <div className="announcement-list">
              {announcements.map((item) => (
                <Card className="announcement-card" key={item.id}>
                  <div className="announcement-icon"><Megaphone size={15} /></div>
                  <div className="announcement-copy"><div className="announcement-meta">{format(parseISO(item.created_at), 'd MMM · HH:mm', { locale: es })}</div><strong>{item.title}</strong><p>{item.body}</p></div>
                </Card>
              ))}
            </div>
          ) : <Card><EmptyState icon={<Megaphone size={18} />} title="No hay avisos nuevos" detail="Cuando el entrenador publique información, la verás aquí." /></Card>}
          {profile?.role === 'coach' && <div className="coach-hint"><Users size={15} /><span>Las publicaciones solo son visibles para Cullera FC.</span></div>}
        </aside>
      </div>
    </>
  )
}
