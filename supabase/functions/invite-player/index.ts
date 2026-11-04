// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function findAuthUserByEmail(adminClient, email: string) {
  const perPage = 200
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users ?? []
    const match = users.find((user) => user.email?.toLowerCase() === email)
    if (match) return match
    if (users.length < perPage) return null
  }
  return null
}

async function ensurePlayerProfile(adminClient, { userId, teamId, fullName }) {
  const { data: existing } = await adminClient.from('profiles').select('id, team_id, role, active').eq('id', userId).maybeSingle()
  if (!existing) {
    const { error } = await adminClient.from('profiles').insert({
      id: userId,
      team_id: teamId,
      full_name: fullName,
      role: 'player',
      active: true,
    })
    if (error) return { error: 'No se pudo crear el perfil del jugador.' }
    return { ok: true }
  }
  if (existing.role === 'coach') return { error: 'Ese correo pertenece al entrenador.' }
  if (existing.team_id !== teamId) return { error: 'Ese correo ya pertenece a otro equipo.' }
  const { error } = await adminClient.from('profiles').update({
    full_name: fullName,
    role: 'player',
    active: true,
  }).eq('id', userId)
  if (error) return { error: 'No se pudo reactivar el perfil del jugador.' }
  return { ok: true }
}

async function linkPlayer(adminClient, { playerId, teamId, userId, fullName, email }) {
  const { data: taken } = await adminClient.from('players').select('id').eq('user_id', userId).neq('id', playerId).maybeSingle()
  if (taken) return { error: 'Esa cuenta ya está vinculada a otra ficha de la plantilla.' }
  const { error } = await adminClient.from('players').update({
    user_id: userId,
    full_name: fullName,
    invite_email: email,
  }).eq('id', playerId).eq('team_id', teamId)
  if (error) return { error: 'No se pudo vincular la cuenta a la ficha de jugador.' }
  return { ok: true }
}

async function inviteFresh(adminClient, email: string, fullName: string) {
  const { data: invited, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })
  if (error || !invited?.user) {
    return { error: error?.message ?? 'No se pudo enviar la invitación.', code: error?.code ?? null }
  }
  return { user: invited.user }
}

/**
 * Siempre intenta que llegue un correo:
 * - sin cuenta / invitación pendiente → inviteUserByEmail (o borra huérfano y reinvita)
 * - cuenta confirmada → correo de recuperación de acceso
 */
async function deliverInvite(adminClient, email: string, fullName: string, teamId: string) {
  let existing = null
  try {
    existing = await findAuthUserByEmail(adminClient, email)
  } catch (lookupError) {
    console.error('ERROR BUSCANDO USUARIO:', lookupError)
    return { error: 'No se pudo consultar Auth para ese correo.' }
  }

  if (existing) {
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, team_id, role, active')
      .eq('id', existing.id)
      .maybeSingle()

    if (existingProfile?.role === 'coach') {
      return { error: 'Ese correo pertenece al entrenador.' }
    }
    if (existingProfile && existingProfile.team_id !== teamId) {
      return { error: 'Ese correo ya pertenece a otro equipo.' }
    }

    if (existing.email_confirmed_at) {
      const { error: recoveryError } = await adminClient.auth.resetPasswordForEmail(email)
      if (recoveryError) {
        console.error('ERROR REENVIANDO ACCESO:', recoveryError)
        return { error: 'No se pudo reenviar el correo de acceso.' }
      }
      return { user: existing, resent: true, recovery: true }
    }

    // Invitación pendiente: borrar y volver a invitar para que salga el email otra vez.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.id)
    if (deleteError) {
      console.error('ERROR BORRANDO USUARIO HUÉRFANO:', deleteError)
      return { error: 'No se pudo limpiar la cuenta pendiente para reinvitar.' }
    }
  }

  const invited = await inviteFresh(adminClient, email, fullName)
  if (!invited.user) return { error: invited.error ?? 'No se pudo enviar la invitación.', code: invited.code }
  return { user: invited.user, resent: Boolean(existing), recovery: false }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405, headers })

  const authorization = request.headers.get('authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !anonKey || !serviceKey) {
    return Response.json({ error: 'Configuración incompleta de la función.' }, { status: 500, headers })
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Inicia sesión para invitar a un jugador.' }, { status: 401, headers })

  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('team_id, role, active')
    .eq('id', user.id)
    .maybeSingle()
  if (profileError || !callerProfile || !callerProfile.active || callerProfile.role !== 'coach') {
    return Response.json({ error: 'Solo un entrenador activo puede invitar jugadores.' }, { status: 403, headers })
  }

  let body: { email?: string; full_name?: string; player_id?: string; resend?: boolean }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Solicitud JSON no válida.' }, { status: 400, headers })
  }

  const playerId = body.player_id
  const fullName = body.full_name?.trim()
  if (!fullName || fullName.length > 120 || !playerId) {
    return Response.json({ error: 'Completa nombre y ficha de jugador.' }, { status: 400, headers })
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, team_id, user_id, invite_email')
    .eq('id', playerId)
    .eq('team_id', callerProfile.team_id)
    .maybeSingle()
  if (playerError || !player) return Response.json({ error: 'No se encontró la ficha en Cullera FC.' }, { status: 404, headers })

  const email = (body.email?.trim() || player.invite_email || '').toLowerCase()
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: 'Esta ficha no tiene correo guardado. Indica un correo para invitar.' }, { status: 400, headers })
  }

  const { error: emailSaveError } = await adminClient
    .from('players')
    .update({ invite_email: email })
    .eq('id', player.id)
    .eq('team_id', callerProfile.team_id)
  if (emailSaveError) {
    const duplicated = /unique|duplicate/i.test(emailSaveError.message)
    return Response.json({
      error: duplicated
        ? 'Ese correo ya está asignado a otra ficha de la plantilla.'
        : 'No se pudo guardar el correo en la ficha del jugador. ¿Aplicaste la migración invite_email?',
    }, { status: 500, headers })
  }

  const delivery = await deliverInvite(adminClient, email, fullName, callerProfile.team_id)
  if (!delivery.user) {
    console.error('ERROR INVITANDO JUGADOR:', delivery)
    return Response.json({ error: delivery.error ?? 'No se pudo enviar la invitación.', code: delivery.code ?? null }, { status: 400, headers })
  }

  const profileResult = await ensurePlayerProfile(adminClient, {
    userId: delivery.user.id,
    teamId: callerProfile.team_id,
    fullName,
  })
  if (profileResult.error) {
    if (!delivery.recovery && !delivery.user.email_confirmed_at) await adminClient.auth.admin.deleteUser(delivery.user.id)
    return Response.json({ error: profileResult.error }, { status: 500, headers })
  }

  const linkResult = await linkPlayer(adminClient, {
    playerId: player.id,
    teamId: callerProfile.team_id,
    userId: delivery.user.id,
    fullName,
    email,
  })
  if (linkResult.error) {
    if (!delivery.resent && !delivery.recovery && !delivery.user.email_confirmed_at) {
      await adminClient.from('profiles').delete().eq('id', delivery.user.id)
      await adminClient.auth.admin.deleteUser(delivery.user.id)
    }
    return Response.json({ error: linkResult.error }, { status: 500, headers })
  }

  return Response.json({
    invited: true,
    resent: Boolean(delivery.resent || body.resend),
    recovery: Boolean(delivery.recovery),
    email,
  }, { status: 200, headers })
})
