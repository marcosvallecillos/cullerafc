// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
})

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') ?? ''
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405, headers })

  const authorization = request.headers.get('authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!authorization || !supabaseUrl || !anonKey || !serviceKey) return Response.json({ error: 'Configuración incompleta de la función.' }, { status: 500, headers })

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Inicia sesión para invitar a un jugador.' }, { status: 401, headers })

  const { data: callerProfile, error: profileError } = await adminClient.from('profiles').select('team_id, role, active').eq('id', user.id).maybeSingle()
  if (profileError || !callerProfile || !callerProfile.active || callerProfile.role !== 'coach') return Response.json({ error: 'Solo un entrenador activo puede invitar jugadores.' }, { status: 403, headers })

  let body: { email?: string; full_name?: string; player_id?: string }
  try { body = await request.json() } catch { return Response.json({ error: 'Solicitud JSON no válida.' }, { status: 400, headers }) }
  const email = body.email?.trim().toLowerCase()
  const fullName = body.full_name?.trim()
  const playerId = body.player_id
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 120 || !playerId) return Response.json({ error: 'Completa nombre, correo válido y ficha de jugador.' }, { status: 400, headers })

  const { data: player, error: playerError } = await adminClient.from('players').select('id, team_id, user_id').eq('id', playerId).eq('team_id', callerProfile.team_id).maybeSingle()
  if (playerError || !player) return Response.json({ error: 'No se encontró la ficha en Cullera FC.' }, { status: 404, headers })
  if (player.user_id) return Response.json({ error: 'Este jugador ya tiene una cuenta vinculada.' }, { status: 409, headers })

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } })
  if (inviteError || !invited.user) return Response.json({ error: inviteError?.message ?? 'No se pudo enviar la invitación.' }, { status: 400, headers })
  const newUserId = invited.user.id
  const { error: newProfileError } = await adminClient.from('profiles').insert({ id: newUserId, team_id: callerProfile.team_id, full_name: fullName, role: 'player', active: true })
  if (newProfileError) {
    await adminClient.auth.admin.deleteUser(newUserId)
    return Response.json({ error: 'Se envió la invitación, pero no se pudo crear el perfil del equipo.' }, { status: 500, headers })
  }
  const { error: linkError } = await adminClient.from('players').update({ user_id: newUserId, full_name: fullName }).eq('id', player.id).eq('team_id', callerProfile.team_id)
  if (linkError) {
    await adminClient.from('profiles').delete().eq('id', newUserId)
    await adminClient.auth.admin.deleteUser(newUserId)
    return Response.json({ error: 'No se pudo vincular la cuenta a la ficha de jugador.' }, { status: 500, headers })
  }
  return Response.json({ invited: true }, { status: 200, headers })
})
