import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { Button, Field, InlineMessage } from '../components/ui'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL ?? '')
  const [password, setPassword] = useState(import.meta.env.VITE_ADMIN_PASSWORD ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const result = await signIn(email, password)
    setError(result.error)
    setBusy(false)
  }
  return <div className="auth-page"><div className="auth-card">
    <div className="auth-brand"><img src="/cullera_logo.jpg" alt="Escudo de Cullera FC" /><div><span>Acceso privado</span><strong>CULLERA FC</strong></div></div>
    <div className="auth-copy"><div className="eyebrow">Equipo</div><h1>Entra en<br /><em>la pizarra</em></h1><p>Táctica, plantilla y calendario del club.</p></div>
    <form className="auth-form" onSubmit={submit}>
      <Field label="Correo electrónico" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@correo.com" />
      <Field label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" />
      {error && <InlineMessage tone="error">{error}</InlineMessage>}
      <Button type="submit" disabled={busy} className="auth-submit">{busy ? 'Comprobando…' : 'Entrar'}<ArrowRight size={18} /></Button>
    </form>
    <div className="auth-private"><LockKeyhole size={15} /><span>Solo por invitación</span></div>
    <p className="auth-help">Sin acceso: pide al entrenador que te invite.</p>
    <div className="auth-footer"><Mail size={13} /> Cullera FC</div>
  </div></div>
}
