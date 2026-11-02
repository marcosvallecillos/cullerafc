// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

function emailAlreadyTaken(message = '', code = '') {
  const text = `${code} ${message}`.toLowerCase()
  return /already.?registered|already.?been.?registered|email.?exists|user.?already|duplicate|already exists/.test(text)
}

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

async function ensurePlayerProfile(adminClient, {
  userId,
  teamId,
  fullName,
}) {
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

async function linkPlayer(adminClient, { playerId, teamId, userId, fullName }) {
  const { data: taken } = await adminClient.from('players').select('id').eq('user_id', userId).neq('id', playerId).maybeSingle()
  if (taken) return { error: 'Esa cuenta ya está vinculada a otra ficha de la plantilla.' }
  const { error } = await adminClient.from('players').update({
    user_id: userId,
    full_name: fullName,
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
  return { user: invited.user, resent: false }
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

  let body: { email?: string; full_name?: string; player_id?: string }
  try { body = await request.json() } catch {
    return Response.json({ error: 'Solicitud JSON no válida.' }, { status: 400, headers })
  }

  const email = body.email?.trim().toLowerCase()
  const fullName = body.full_name?.trim()
  const playerId = body.player_id
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120 || !playerId) {
    return Response.json({ error: 'Completa nombre, correo válido y ficha de jugador.' }, { status: 400, headers })
  }

  const { data: player, error: playerError } = await adminClient
    .from('players')
    .select('id, team_id, user_id')
    .eq('id', playerId)
    .eq('team_id', callerProfile.team_id)
    .maybeSingle()
  if (playerError || !player) return Response.json({ error: 'No se encontró la ficha en Cullera FC.' }, { status: 404, headers })

  if (player.user_id) {
    const { data: linkedProfile } = await adminClient
      .from('profiles')
      .select('id, active, role')
      .eq('id', player.user_id)
      .maybeSingle()
    if (linkedProfile?.active && linkedProfile.role === 'player') {
      return Response.json({ error: 'Este jugador ya tiene una cuenta vinculada.' }, { status: 409, headers })
    }
    // Enlace huérfano tras borrar el perfil: liberar la ficha y seguir.
    await adminClient.from('players').update({ user_id: null }).eq('id', player.id)
  }

  let authUser = null
  let resent = false

  const firstInvite = await inviteFresh(adminClient, email, fullName)
  if (firstInvite.user) {
    authUser = firstInvite.user
  } else if (emailAlreadyTaken(firstInvite.error, firstInvite.code)) {
    // Cuenta en Auth sin perfil usable (p. ej. borraste profiles): reutilizar o recrear invitación.
    let existing
    try {
      existing = await findAuthUserByEmail(adminClient, email)
    } catch (lookupError) {
      console.error('ERROR BUSCANDO USUARIO:', lookupError)
      return Response.json({ error: 'El correo ya existe en Auth, pero no se pudo recuperar la cuenta.' }, { status: 400, headers })
    }
    if (!existing) {
      return Response.json({ error: 'El correo ya está registrado, pero no se encontró la cuenta.' }, { status: 400, headers })
    }

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, team_id, role, active')
      .eq('id', existing.id)
      .maybeSingle()

    if (existingProfile?.role === 'coach') {
      return Response.json({ error: 'Ese correo pertenece al entrenador.' }, { status: 409, headers })
    }
    if (existingProfile && existingProfile.team_id !== callerProfile.team_id) {
      return Response.json({ error: 'Ese correo ya pertenece a otro equipo.' }, { status: 409, headers })
    }

    if (!existing.email_confirmed_at) {
      // Invitación pendiente sin perfil: borrar Auth huérfano y reenviar invite limpio.
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(existing.id)
      if (deleteError) {
        console.error('ERROR BORRANDO USUARIO HUÉRFANO:', deleteError)
        return Response.json({ error: 'No se pudo limpiar la cuenta pendiente para reinvitar.' }, { status: 500, headers })
      }
      const retry = await inviteFresh(adminClient, email, fullName)
      if (!retry.user) {
        return Response.json({ error: retry.error ?? 'No se pudo reenviar la invitación.', code: retry.code }, { status: 400, headers })
      }
      authUser = retry.user
      resent = true
    } else {
      authUser = existing
      resent = true
    }
  } else {
    console.error('ERROR INVITANDO JUGADOR:', firstInvite)
    return Response.json({ error: firstInvite.error ?? 'No se pudo enviar la invitación.', code: firstInvite.code }, { status: 400, headers })
  }

  const profileResult = await ensurePlayerProfile(adminClient, {
    userId: authUser.id,
    teamId: callerProfile.team_id,
    fullName,
  })
  if (profileResult.error) {
    if (!resent && !authUser.email_confirmed_at) await adminClient.auth.admin.deleteUser(authUser.id)
    return Response.json({ error: profileResult.error }, { status: 500, headers })
  }

  const linkResult = await linkPlayer(adminClient, {
    playerId: player.id,
    teamId: callerProfile.team_id,
    userId: authUser.id,
    fullName,
  })
  if (linkResult.error) {
    if (!resent && !authUser.email_confirmed_at) {
      await adminClient.from('profiles').delete().eq('id', authUser.id)
      await adminClient.auth.admin.deleteUser(authUser.id)
    }
    return Response.json({ error: linkResult.error }, { status: 500, headers })
  }

  return Response.json({
    invited: true,
    resent,
    confirmed: Boolean(authUser.email_confirmed_at),
  }, { status: 200, headers })
})
