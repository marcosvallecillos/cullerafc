import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, MailPlus, Pencil, Plus, Search, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, EmptyState, Field, InlineMessage, LoadingState, PageHeading, Pill, SelectField } from '../../components/ui'
import { availabilityLabels } from '../../lib/format'
import { supabase } from '../../lib/supabase/client'
import type { Availability, Player } from '../../lib/types'

const availabilityTone: Record<Availability, 'lime' | 'red' | 'neutral'> = { available: 'lime', injured: 'red', temporary_leave: 'neutral' }
interface PlayerForm { full_name: string; jersey_number: string; position: string; availability: Availability; email: string; photo: File | null }
const blankForm = (): PlayerForm => ({ full_name: '', jersey_number: '', position: '', availability: 'available', email: '', photo: null })

export function RosterPage() {
  const { profile } = useAuth()
  const isCoach = profile?.role === 'coach'
  const [players, setPlayers] = useState<Player[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [form, setForm] = useState<PlayerForm>(blankForm())
  const [saving, setSaving] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    if (!supabase || !profile) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('players').select('*').eq('team_id', profile.team_id).order('jersey_number', { ascending: true, nullsFirst: false }).order('full_name')
    if (queryError) setError('No se pudo cargar la plantilla. Comprueba que el esquema de Supabase esté aplicado.')
    const rows = (data as Player[] | null) ?? []
    setPlayers(rows)
    const withPhoto = rows.filter((player) => player.photo_path)
    if (withPhoto.length) {
      const { data: signed } = await supabase.storage.from('player-photos').createSignedUrls(withPhoto.map((player) => player.photo_path!), 3600)
      if (signed) setPhotoUrls(Object.fromEntries(signed.flatMap((item) => item.path && item.signedUrl ? [[item.path, item.signedUrl]] : [])))
    } else setPhotoUrls({})
    setLoading(false)
  }

  useEffect(() => { void load() }, [profile?.team_id])

  const visiblePlayers = useMemo(() => players.filter((player) => `${player.full_name} ${player.position ?? ''} ${player.jersey_number ?? ''}`.toLowerCase().includes(search.toLowerCase())), [players, search])

  function startCreate() {
    setEditing(null)
    setForm(blankForm())
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  function startEdit(player: Player) {
    setEditing(player)
    setForm({ full_name: player.full_name, jersey_number: player.jersey_number?.toString() ?? '', position: player.position ?? '', availability: player.availability, email: '', photo: null })
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  async function uploadPhoto(playerId: string, file: File) {
    if (!supabase || !profile) return null
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${profile.team_id}/${playerId}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('player-photos').upload(path, file, { upsert: false, contentType: file.type, cacheControl: '3600' })
    if (uploadError) throw new Error('El jugador se guardó, pero no se pudo subir la fotografía. Revisa el bucket player-photos.')
    return path
  }

  async function savePlayer(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !profile) return
    if (!form.full_name.trim()) { setError('Escribe el nombre completo del jugador.'); return }
    const jersey = form.jersey_number.trim() ? Number(form.jersey_number) : null
    if (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) { setError('El dorsal debe ser un número entre 0 y 99.'); return }
    if (form.photo && (!form.photo.type.startsWith('image/') || form.photo.size > 5 * 1024 * 1024)) { setError('La foto debe ser una imagen de hasta 5 MB.'); return }
    setSaving(true)
    setError(null)
    setSuccess(null)
    let playerId = editing?.id
    let oldPhotoPath = editing?.photo_path ?? null
    const values = { team_id: profile.team_id, full_name: form.full_name.trim(), jersey_number: jersey, position: form.position.trim() || null, availability: form.availability }
    if (editing) {
      const { error: updateError } = await supabase.from('players').update(values).eq('id', editing.id).eq('team_id', profile.team_id)
      if (updateError) { setError('No se pudo actualizar el jugador.'); setSaving(false); return }
    } else {
      const { data, error: insertError } = await supabase.from('players').insert(values).select('id').single()
      if (insertError || !data) { setError('No se pudo crear el jugador. Comprueba que el dorsal no esté duplicado.'); setSaving(false); return }
      playerId = data.id as string
    }
    let warning: string | null = null
    if (playerId && form.email.trim() && !editing) {
      const { error: inviteError } = await supabase.functions.invoke('invite-player', { body: { email: form.email.trim(), player_id: playerId, full_name: form.full_name.trim() } })
      if (inviteError) warning = 'Jugador creado, pero no se pudo enviar la invitación. Despliega invite-player en Supabase y vuelve a intentarlo desde la ficha.'
    }
    if (playerId && form.photo) {
      try {
        const path = await uploadPhoto(playerId, form.photo)
        const { error: photoError } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId).eq('team_id', profile.team_id)
        if (photoError) throw new Error('El jugador se guardó, pero no se pudo asociar la fotografía.')
        if (oldPhotoPath) await supabase.storage.from('player-photos').remove([oldPhotoPath])
      } catch (photoError) {
        setError(photoError instanceof Error ? photoError.message : 'No se pudo guardar la fotografía.')
        setSaving(false)
        await load()
        return
      }
    }
    if (warning) setError(warning)
    else setSuccess(editing ? 'Ficha del jugador actualizada.' : 'Jugador añadido a la plantilla.')
    setShowForm(false)
    setForm(blankForm())
    await load()
    setSaving(false)
  }

  async function invitePlayer(player: Player) {
    if (!supabase) return
    const email = window.prompt(`Correo de acceso para ${player.full_name}:`)?.trim()
    if (!email) return
    setInvitingId(player.id)
    setError(null)
    setSuccess(null)
    const { error: inviteError } = await supabase.functions.invoke('invite-player', { body: { email, player_id: player.id, full_name: player.full_name } })
    if (inviteError) setError('No se pudo enviar la invitación. Comprueba que la función invite-player esté desplegada y que el correo no tenga una cuenta existente.')
    else setSuccess(`Invitación enviada a ${email}.`)
    await load()
    setInvitingId(null)
  }

  async function deletePlayer(player: Player) {
    if (!supabase || !window.confirm(`¿Eliminar a ${player.full_name} de la plantilla? Esta acción no se puede deshacer y revoca el acceso de su cuenta al equipo.`)) return
    const { error: deleteError } = await supabase.from('players').delete().eq('id', player.id).eq('team_id', profile?.team_id)
    if (deleteError) setError('No se pudo eliminar el jugador.')
    else {
      const { error: photoDeleteError } = player.photo_path ? await supabase.storage.from('player-photos').remove([player.photo_path]) : { error: null }
      if (photoDeleteError) setError('Jugador eliminado y acceso revocado; revisa Storage porque no se pudo retirar su fotografía.')
      else setSuccess('Jugador eliminado, fotografía retirada y acceso al equipo revocado.')
      await load()
    }
  }

  if (loading) return <><PageHeading eyebrow="CULLERA FC · EQUIPO" title="La plantilla." description="El equipo, dorsal a dorsal." /><Card><LoadingState label="Cargando jugadores…" /></Card></>

  return <>
    <PageHeading eyebrow="CULLERA FC · EQUIPO" title="La plantilla." description={`${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'} en el equipo.`} action={isCoach ? <Button onClick={startCreate}><Plus size={16} /> Añadir jugador</Button> : undefined} />
    {error && <InlineMessage tone="error">{error}</InlineMessage>}
    {success && <InlineMessage tone="success">{success}</InlineMessage>}
    {showForm && isCoach && <Card className="roster-form-card"><form onSubmit={savePlayer}>
      <div className="section-head"><h2>{editing ? 'Editar ficha' : 'Nuevo jugador'}</h2><button type="button" aria-label="Cerrar formulario" onClick={() => setShowForm(false)}><X size={17} /></button></div>
      <div className="roster-form-grid"><Field label="Nombre y apellidos" autoFocus required maxLength={120} value={form.full_name} onChange={(event) => setForm((value) => ({ ...value, full_name: event.target.value }))} placeholder="Nombre completo" /><Field label="Dorsal" type="number" min="0" max="99" value={form.jersey_number} onChange={(event) => setForm((value) => ({ ...value, jersey_number: event.target.value }))} placeholder="—" /><SelectField label="Posición" value={form.position} onChange={(event) => setForm((value) => ({ ...value, position: event.target.value }))}><option value="">Sin especificar</option>{['Portero', 'Defensa', 'Medio', 'Delantero'].map((item) => <option key={item}>{item}</option>)}</SelectField><SelectField label="Disponibilidad" value={form.availability} onChange={(event) => setForm((value) => ({ ...value, availability: event.target.value as Availability }))}><option value="available">Disponible</option><option value="injured">Lesionado</option><option value="temporary_leave">Baja temporal</option></SelectField><label className="field"><span>Fotografía</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm((value) => ({ ...value, photo: event.target.files?.[0] ?? null }))} /><small>JPG, PNG o WebP · hasta 5 MB</small></label>{!editing && <Field className="invite-email-field" label="Correo para invitar (opcional)" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="jugador@correo.com" hint="Le enviaremos un enlace privado para crear su contraseña." />}</div>
      <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : <><Check size={15} /> {editing ? 'Guardar cambios' : 'Añadir a plantilla'}</>}</Button><Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button></div>
    </form></Card>}
    {isCoach && <InlineMessage tone="info"><MailPlus size={14} /> Puedes crear la ficha sin invitar. Para enviar accesos desde aquí, despliega la función segura <code>invite-player</code> en tu proyecto Supabase.</InlineMessage>}
    <div className="roster-toolbar"><div className="roster-count"><Users size={16} /><span>Integrantes</span><b>{players.length}</b></div><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar jugador" aria-label="Buscar jugador" /></label></div>
    {visiblePlayers.length ? <div className="roster-grid">{visiblePlayers.map((player) => <Card className="player-card" key={player.id}>
      <div className="player-card-main"><div className="player-photo">{player.photo_path && photoUrls[player.photo_path] ? <img src={photoUrls[player.photo_path]} alt={`Fotografía de ${player.full_name}`} /> : <UserRound size={24} />}</div><div className="player-identity"><div className="player-number">{player.jersey_number !== null ? `#${player.jersey_number}` : 'SIN DORSAL'}</div><h3>{player.full_name}</h3><span>{player.position || 'Posición por definir'}</span></div><Pill tone={availabilityTone[player.availability]}>{availabilityLabels[player.availability]}</Pill></div>
      {player.user_id && <div className="player-account"><ShieldCheck size={13} /> Cuenta de equipo vinculada</div>}
      {isCoach && <div className="player-card-actions"><Button variant="secondary" size="sm" onClick={() => startEdit(player)}><Pencil size={14} /> Editar</Button>{!player.user_id && <Button variant="secondary" size="sm" disabled={invitingId === player.id} onClick={() => void invitePlayer(player)}><MailPlus size={14} /> {invitingId === player.id ? 'Enviando…' : 'Invitar'}</Button>}<Button variant="ghost" size="sm" onClick={() => void deletePlayer(player)}><Trash2 size={14} /> Eliminar</Button></div>}
    </Card>)}</div> : <Card><EmptyState icon={<Users size={19} />} title={search ? 'No hay resultados' : 'La plantilla aún está vacía'} detail={search ? 'Prueba con otro nombre, dorsal o posición.' : isCoach ? 'Añade el primer jugador para empezar a preparar alineaciones.' : 'Cuando el entrenador añada jugadores, aparecerán aquí.'} /></Card>}
  </>
}
