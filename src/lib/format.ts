import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ActivityKind, Availability } from './types'

export const activityLabels: Record<ActivityKind, string> = {
  training: 'Entrenamiento',
  friendly: 'Amistoso',
  league: 'Partido de liga',
  other: 'Otro evento',
}

export const availabilityLabels: Record<Availability, string> = {
  available: 'Disponible',
  injured: 'Lesionado',
  temporary_leave: 'Baja temporal',
}

export function formatDate(value: string, pattern = "EEEE d 'de' MMMM") {
  return format(parseISO(value), pattern, { locale: es })
}

export function formatShortDate(value: string) {
  return format(parseISO(value), 'd MMM', { locale: es })
}

export function formatClock(value: string | null) {
  return value ? value.slice(0, 5) : 'Hora por confirmar'
}
