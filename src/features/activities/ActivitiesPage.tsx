import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MapPin, Pencil, Plus, Send, Trash2, Users, X } from 'lucide-react'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, PageHeading, Pill, SelectField, TextareaField } from '../../components/ui'
import { activityLabels, formatClock, formatDate } from '../../lib/format'
import { supabase } from '../../lib/supabase/client'
import type { Activity, ActivityKind, AttendanceResponse } from '../../lib/types'

interface Member { id: string; full_name: string; role: 'coach' | 'player' }
interface AttendanceRow { profile_id: string; response: AttendanceResponse }
interface ActivityForm { title: string; activity_type: ActivityKind; activity_date: string; start_time: string; location: string; description: string; objectives: string }
const blankForm = (date = format(new Date(), 'yyyy-MM-dd')): ActivityForm => ({ title: '', activity_type: 'training', activity_date: date, start_time: '', location: '', description: '', objectives: '' })
const kinds: ActivityKind[] = ['training', 'friendly', 'league', 'other']

export function ActivitiesPage() {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach'
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [activities, setActivities] = useState<Activity[]>([])
  const [upcomingActivities, setUpcomingActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all')
  const [selected, setSelected] = useState<Activity | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [myResponse, setMyResponse] = useState<AttendanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form, setForm] = useState<ActivityForm>(blankForm())
  const [saving, setSaving] = useState(false)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function loadActivities() {
    if (!supabase || !profile) return
    setLoading(true)
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const now = new Date()
    const today = format(now, 'yyyy-MM-dd')
    const currentTime = format(now, 'HH:mm:ss')
    const upcomingWindow = `activity_date.gt.${today},and(activity_date.eq.${today},start_time.gte.${currentTime}),and(activity_date.eq.${today},start_time.is.null)`
    const [calendarResult, upcomingResult] = await Promise.all([
      supabase.from('activities').select('*').eq('team_id', profile.team_id).gte('activity_date', format(first, 'yyyy-MM-dd')).lte('activity_date', format(last, 'yyyy-MM-dd')).order('activity_date').order('start_time'),
      supabase.from('activities').select('*').eq('team_id', profile.team_id).or(upcomingWindow).order('activity_date').order('start_time', { ascending: true, nullsFirst: false }).limit(8),
    ])
    if (calendarResult.error || upcomingResult.error) setError('No se pudieron cargar las actividades. Comprueba la migración de Supabase.')
    setActivities((calendarResult.data as Activity[] | null) ?? [])
    setUpcomingActivities((upcomingResult.data as Activity[] | null) ?? [])
    setLoading(false)
  }

  useEffect(() => { void loadActivities() }, [profile?.team_id, month])

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month])
  const matchingActivities = useMemo(() => activities.filter((item) => (filter === 'all' || item.activity_type === filter)), [activities, filter])
  const dayActivities = matchingActivities.filter((item) => item.activity_date === selectedDate)
  const visibleUpcoming = upcomingActivities.filter((item) => filter === 'all' || item.activity_type === filter)

  async function loadActivityDetail(activity: Activity) {
    if (!supabase || !profile) return
    setSelected(activity)
    setError(null)
    const [attendanceResult, membersResult, ownResult] = await Promise.all([
      supabase.from('activity_attendance').select('profile_id, response').eq('activity_id', activity.id),
      supabase.from('profiles').select('id, full_name, role').eq('team_id', profile.team_id).eq('active', true).order('full_name'),
      supabase.from('activity_attendance').select('response').eq('activity_id', activity.id).eq('profile_id', profile.id).maybeSingle(),
    ])
    if (attendanceResult.error || membersResult.error) setError('No se pudieron cargar las respuestas de asistencia.')
    setAttendance((attendanceResult.data as AttendanceRow[] | null) ?? [])
    setMembers((membersResult.data as Member[] | null) ?? [])
    setMyResponse((ownResult.data?.response as AttendanceResponse | undefined) ?? null)
  }

  async function setResponse(response: AttendanceResponse) {
    if (!supabase || !profile || !selected) return
    setResponding(true)
    const { error: responseError } = await supabase.from('activity_attendance').upsert({ activity_id: selected.id, profile_id: profile.id, team_id: profile.team_id, response, responded_at: new Date().toISOString() }, { onConflict: 'activity_id,profile_id' })
    if (responseError) setError('No se pudo guardar tu respuesta. Inténtalo de nuevo.')
    else {
      setMyResponse(response)
      setAttendance((current) => [...current.filter((item) => item.profile_id !== profile.id), { profile_id: profile.id, response }])
      setSuccess(response === 'yes' ? 'Asistencia confirmada.' : 'Has indicado que no podrás asistir.')
    }
    setResponding(false)
  }

  function openCreate() {
    setEditing(null)
    setForm(blankForm(selectedDate))
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  function openEdit(activity: Activity) {
    setEditing(activity)
    setForm({ title: activity.title, activity_type: activity.activity_type, activity_date: activity.activity_date, start_time: activity.start_time?.slice(0, 5) ?? '', location: activity.location ?? '', description: activity.description ?? '', objectives: activity.objectives ?? '' })
    setShowForm(true)
    setError(null)
    setSuccess(null)
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile) return
    if (!form.title.trim()) { setError('Añade un título a la actividad.'); return }
    setSaving(true)
    setError(null)
    const values = { team_id: profile.team_id, created_by: profile.id, title: form.title.trim(), activity_type: form.activity_type, activity_date: form.activity_date, start_time: form.start_time || null, location: form.location.trim() || null, description: form.description.trim() || null, objectives: form.objectives.trim() || null }
    const result = editing ? await supabase.from('activities').update(values).eq('id', editing.id).eq('team_id', profile.team_id) : await supabase.from('activities').insert(values)
    if (result.error) setError('No se pudo guardar la actividad. Comprueba tus permisos de entrenador.')
    else { setSuccess(editing ? 'Actividad actualizada.' : 'Actividad creada.'); setShowForm(false); await loadActivities() }
    setSaving(false)
  }

  async function deleteActivity(activity: Activity) {
    if (!supabase || !window.confirm(`¿Eliminar “${activity.title}”? Las respuestas asociadas también se eliminarán.`)) return
    const { error: deleteError } = await supabase.from('activities').delete().eq('id', activity.id).eq('team_id', profile?.team_id)
    if (deleteError) setError('No se pudo eliminar la actividad.')
    else { if (selected?.id === activity.id) setSelected(null); setSuccess('Actividad eliminada.'); await loadActivities() }
  }

  const attendanceById = new Map(attendance.map((item) => [item.profile_id, item.response]))
  const confirmedCount = attendance.filter((item) => item.response === 'yes').length

  return <>
    <PageHeading eyebrow="CALENDARIO · CULLERA FC" title="Los próximos días." description="Entrenamientos, partidos y actividades del equipo." action={isCoach ? <Button onClick={openCreate}><Plus size={16} /> Crear actividad</Button> : undefined} />
    {error && <InlineMessage tone="error">{error}</InlineMessage>}{success && <InlineMessage tone="success">{success}</InlineMessage>}
    {showForm && isCoach && <Card className="activity-form-card"><form onSubmit={saveActivity}>
      <div className="section-head"><h2>{editing ? 'Editar actividad' : 'Nueva actividad'}</h2><button type="button" aria-label="Cerrar" onClick={() => setShowForm(false)}><X size={17} /></button></div>
      <div className="activity-form-grid"><Field label="Nombre o título" required maxLength={110} value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="Ej. Entrenamiento de salida" /><SelectField label="Tipo" value={form.activity_type} onChange={(event) => setForm((value) => ({ ...value, activity_type: event.target.value as ActivityKind }))}>{kinds.map((kind) => <option value={kind} key={kind}>{activityLabels[kind]}</option>)}</SelectField><Field label="Fecha" type="date" required value={form.activity_date} onChange={(event) => setForm((value) => ({ ...value, activity_date: event.target.value }))} /><Field label="Hora de inicio" type="time" value={form.start_time} onChange={(event) => setForm((value) => ({ ...value, start_time: event.target.value }))} /><Field label="Ubicación" value={form.location} maxLength={180} onChange={(event) => setForm((value) => ({ ...value, location: event.target.value }))} placeholder="Campo / dirección" /><Field label="Objetivos o material" value={form.objectives} maxLength={500} onChange={(event) => setForm((value) => ({ ...value, objectives: event.target.value }))} placeholder="Material necesario" /><TextareaField className="activity-description-field" label="Descripción" value={form.description} maxLength={1200} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} placeholder="Información para el equipo…" /></div>
      <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : <><Check size={15} /> {editing ? 'Guardar cambios' : 'Crear actividad'}</>}</Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button></div>
    </form></Card>}

    <div className="activities-layout">
      <Card className="calendar-card">
        <div className="calendar-top"><div><span className="eyebrow">CALENDARIO MENSUAL</span><h2>{format(month, 'MMMM yyyy', { locale: es })}</h2></div><div className="calendar-arrows"><button aria-label="Mes anterior" onClick={() => { setSelected(null); setMonth((current) => subMonths(current, 1)) }}><ArrowLeft size={17} /></button><button aria-label="Mes siguiente" onClick={() => { setSelected(null); setMonth((current) => addMonths(current, 1)) }}><ArrowRight size={17} /></button></div></div>
        <div className="calendar-grid calendar-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => <span key={day}>{day}</span>)}</div>
        {loading ? <LoadingState label="Cargando calendario…" /> : <div className="calendar-grid calendar-days">{days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd')
          const count = activities.filter((item) => item.activity_date === dateKey).length
          const selectedDay = selectedDate === dateKey
          return <button key={dateKey} type="button" className={`calendar-day ${!isSameMonth(day, month) ? 'outside-month' : ''} ${selectedDay ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`} onClick={() => { setSelectedDate(dateKey); setSelected(null) }}><span>{format(day, 'd')}</span>{count > 0 && <i className="calendar-dot" />}</button>
        })}</div>}
        <div className="calendar-key"><span><i /> Día con actividad</span><span>Selecciona una fecha para ver el detalle</span></div>
      </Card>

      <div className="activity-details-column">
        <div className="activity-date-heading"><div><span className="eyebrow">{format(parseISO(selectedDate), 'EEEE', { locale: es }).toUpperCase()}</span><h2>{format(parseISO(selectedDate), "d 'de' MMMM", { locale: es })}</h2></div><SelectField label="Filtro" className="activity-filter" value={filter} onChange={(event) => setFilter(event.target.value as ActivityKind | 'all')}><option value="all">Todos</option>{kinds.map((kind) => <option key={kind} value={kind}>{activityLabels[kind]}</option>)}</SelectField></div>
        {dayActivities.length ? <div className="day-activity-list">{dayActivities.map((activity) => <Card key={activity.id} className={`activity-list-card ${selected?.id === activity.id ? 'selected' : ''}`}><button type="button" className="activity-list-main" onClick={() => void loadActivityDetail(activity)}><div className="activity-list-date"><strong>{activity.start_time ? activity.start_time.slice(0, 5) : '—:—'}</strong><span>{activity.start_time ? 'HORA' : 'PENDIENTE'}</span></div><div className="activity-list-copy"><Pill tone={activity.activity_type === 'league' ? 'lime' : 'neutral'}>{activityLabels[activity.activity_type]}</Pill><strong>{activity.title}</strong>{activity.location && <span><MapPin size={12} />{activity.location}</span>}</div><ArrowRight size={15} /></button></Card>)}</div> : <Card><EmptyState icon={<CalendarDays size={19} />} title="Nada programado para este día" detail={isCoach ? 'Crea una actividad para convocar al equipo.' : 'Elige otra fecha para ver las actividades.'} /></Card>}
        {selected && <Card className="activity-detail-card"><div className="activity-detail-top"><div><span className="eyebrow">DETALLE DE ACTIVIDAD</span><h3>{selected.title}</h3></div>{isCoach && <div className="detail-actions"><button aria-label="Editar actividad" onClick={() => openEdit(selected)}><Pencil size={15} /></button><button aria-label="Eliminar actividad" onClick={() => void deleteActivity(selected)}><Trash2 size={15} /></button></div>}</div><div className="activity-detail-meta"><span><CalendarDays size={14} />{formatDate(selected.activity_date)}</span><span><Clock3 size={14} />{formatClock(selected.start_time)}</span>{selected.location && <span><MapPin size={14} />{selected.location}</span>}<Pill>{activityLabels[selected.activity_type]}</Pill></div>{selected.description && <p className="activity-detail-description">{selected.description}</p>}{selected.objectives && <div className="activity-objectives"><strong>Objetivos / material</strong><p>{selected.objectives}</p></div>}
          {!isCoach && <div className="rsvp-box"><div><strong>¿Contamos contigo?</strong><small>Tu respuesta solo puede cambiarla tu cuenta.</small></div><div className="rsvp-actions"><Button size="sm" variant={myResponse === 'yes' ? 'primary' : 'secondary'} disabled={responding} onClick={() => void setResponse('yes')}><Check size={14} /> Voy</Button><Button size="sm" variant={myResponse === 'no' ? 'danger' : 'secondary'} disabled={responding} onClick={() => void setResponse('no')}><X size={14} /> No puedo</Button></div></div>}
          <div className="attendance-heading"><div><Users size={15} /><strong>Respuesta del equipo</strong></div><span>{confirmedCount} confirmados</span></div>
          <div className="attendance-list">{members.map((member) => { const response = attendanceById.get(member.id); return <div className="attendance-person" key={member.id}><span className="attendance-avatar">{member.full_name.slice(0, 1).toUpperCase()}</span><span className="attendance-name">{member.full_name}{member.role === 'coach' && <small> · Entrenador</small>}</span><Pill tone={response === 'yes' ? 'lime' : response === 'no' ? 'red' : 'neutral'}>{response === 'yes' ? 'Confirmado' : response === 'no' ? 'No asiste' : 'Pendiente'}</Pill></div>})}</div>
        </Card>}
        {!dayActivities.length && !loading && <div className="activity-next-link"><Send size={15} /> Las próximas convocatorias aparecerán en el calendario.</div>}
      </div>
    </div>
    <section className="upcoming-activity-section">
      <div className="section-head"><h2>Próximas actividades</h2><span>{visibleUpcoming.length}</span></div>
      {visibleUpcoming.length ? <div className="upcoming-activity-list">{visibleUpcoming.map((item) => <button className="upcoming-activity-row" type="button" key={item.id} onClick={() => { setSelectedDate(item.activity_date); setMonth(startOfMonth(parseISO(item.activity_date))); void loadActivityDetail(item) }}><span className="upcoming-date"><strong>{format(parseISO(item.activity_date), 'd')}</strong><small>{format(parseISO(item.activity_date), 'MMM', { locale: es })}</small></span><span className="upcoming-copy"><Pill>{activityLabels[item.activity_type]}</Pill><strong>{item.title}</strong><small>{formatClock(item.start_time)}{item.location ? ` · ${item.location}` : ''}</small></span><ArrowRight size={15} /></button>)}</div> : <Card><EmptyState icon={<CalendarDays size={18} />} title="No hay próximas actividades" detail="Las nuevas convocatorias aparecerán en esta lista." /></Card>}
    </section>
  </>
}
