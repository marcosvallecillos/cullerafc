import type { ReactNode } from 'react'
import { useAuth } from '../../app/AuthProvider'

export function CoachOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { profile } = useAuth()
  return profile?.role === 'coach' ? children : fallback
}
