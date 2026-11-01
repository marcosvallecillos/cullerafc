import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { CircleAlert, LogOut, ShieldCheck } from 'lucide-react'
import { AuthProvider, useAuth } from './AuthProvider'
import { AppShell } from './AppShell'
import { LoginPage } from './LoginPage'
import { supabaseConfigured } from '../lib/supabase/client'
import { LoadingState } from '../components/ui'

const HomePage = lazy(() => import('../features/home/HomePage').then((module) => ({ default: module.HomePage })))
const TacticsPage = lazy(() => import('../features/tactics/TacticsPage').then((module) => ({ default: module.TacticsPage })))
const RosterPage = lazy(() => import('../features/roster/RosterPage').then((module) => ({ default: module.RosterPage })))
const ActivitiesPage = lazy(() => import('../features/activities/ActivitiesPage').then((module) => ({ default: module.ActivitiesPage })))
const MatchesPage = lazy(() => import('../features/matches/MatchesPage').then((module) => ({ default: module.MatchesPage })))

function AccessGate() {
  const { session, profile, loading, profileError, signOut } = useAuth()
  if (!supabaseConfigured) return <div className="setup-screen"><div className="setup-card"><div className="setup-mark"><CircleAlert size={22} /></div><div className="eyebrow">CONFIGURACIÓN PENDIENTE</div><h1>Conecta el equipo</h1><p>Faltan las variables de entorno de Supabase. No se muestran datos de demostración ni se permite el acceso hasta configurar el backend.</p><div className="setup-code"><span>VITE_SUPABASE_URL</span><span>VITE_SUPABASE_ANON_KEY</span></div><p className="setup-foot">Añade los valores en la configuración protegida del proyecto y reinicia Preview.</p></div></div>
  if (loading) return <div className="full-loading"><LoadingState label="Comprobando acceso…" /></div>
  if (!session) return <LoginPage />
  if (!profile) return <div className="setup-screen"><div className="setup-card"><div className="setup-mark"><ShieldCheck size={22} /></div><div className="eyebrow">CUENTA RECIBIDA</div><h1>Un paso más.</h1><p>{profileError || 'Tu perfil de equipo todavía no está disponible.'}</p><p className="setup-foot">El entrenador debe vincular tu cuenta a Cullera FC. Si la base de datos aún no está configurada, debe aplicar la migración incluida con la app.</p><button className="text-action" onClick={() => void signOut()}><LogOut size={16} /> Cerrar sesión</button></div></div>
  return <Suspense fallback={<div className="full-loading"><LoadingState label="Abriendo sección…" /></div>}><Routes><Route element={<AppShell />}><Route index element={<HomePage />} /><Route path="tactics" element={<TacticsPage />} /><Route path="roster" element={<RosterPage />} /><Route path="activities" element={<ActivitiesPage />} /><Route path="matches" element={<MatchesPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></Suspense>
}

export function App() {
  return <BrowserRouter><AuthProvider><AccessGate /></AuthProvider></BrowserRouter>
}
