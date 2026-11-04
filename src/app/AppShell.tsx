import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, ClipboardList, Home, LogOut, Shield, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from './AuthProvider'

const sections = [
  { to: '/', label: 'Inicio', Icon: Home, end: true },
  { to: '/tactics', label: 'Táctica', Icon: ClipboardList },
  { to: '/roster', label: 'Plantilla', Icon: Users },
  { to: '/activities', label: 'Entrenos', Icon: CalendarDays },
  { to: '/matches', label: 'Partidos', Icon: Shield },
]

export function AppShell() {
  const { profile, signOut } = useAuth()
  return <div className="app-frame">
    <aside className="desktop-sidebar">
      <div className="brand-lockup">
        <img src="/cullera_logo.jpg" alt="" />
        <div><strong>CULLERA<span> FC</span></strong><small>La pizarra</small></div>
      </div>
      <div className="team-switch">
        <span className="team-dot" />
        <div>
          <small>Equipo activo</small>
          <strong>Cullera FC · F7</strong>
        </div>
        <ShieldCheck size={17} />
      </div>
      <nav className="side-nav" aria-label="Navegación principal">
        {sections.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label === 'Entrenos' ? 'Entrenamientos' : label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile-chip">
          <div className="avatar-initial">{profile?.full_name?.trim().slice(0, 1).toUpperCase() || 'C'}</div>
          <div className="profile-meta">
            <strong>{profile?.full_name || 'Mi perfil'}</strong>
            <small>{profile?.role === 'coach' ? 'Entrenador' : 'Jugador'}</small>
          </div>
          <button className="icon-button" aria-label="Cerrar sesión" onClick={() => void signOut()}><LogOut size={17} /></button>
        </div>
      </div>
    </aside>
    <div className="app-main">
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <img src="/cullera_logo.jpg" alt="" />
          <div><strong>CULLERA FC</strong><small>{profile?.role === 'coach' ? 'Área de entrenador' : 'Equipo'}</small></div>
        </div>
        <button className="icon-button" onClick={() => void signOut()} aria-label="Cerrar sesión"><LogOut size={18} /></button>
      </header>
      <div className="desktop-topline">
        <div><span className="topline-pip" /> Cullera FC</div>
        <span>{profile?.role === 'coach' ? 'Entrenador' : 'Jugador'} <b>·</b> {profile?.full_name}</span>
      </div>
      <main className="page-content"><Outlet /></main>
      <nav className="mobile-nav" aria-label="Navegación principal">
        {sections.map(({ to, label, Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={20} strokeWidth={2.1} /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  </div>
}
