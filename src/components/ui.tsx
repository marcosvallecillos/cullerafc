import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import clsx from 'clsx'

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return <button className={clsx('button', `button-${variant}`, `button-${size}`, className)} {...props} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={clsx('card', className)}>{children}</section>
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-heading-action">{action}</div>}</div>
}

export function Field({ label, hint, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className={clsx('field', className)}><span>{label}</span><input {...props} />{hint && <small>{hint}</small>}</label>
}

export function SelectField({ label, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return <label className={clsx('field', className)}><span>{label}</span><select {...props}>{children}</select></label>
}

export function TextareaField({ label, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return <label className={clsx('field', className)}><span>{label}</span><textarea {...props} /></label>
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'lime' | 'red' | 'blue' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function EmptyState({ title, detail, icon }: { title: string; detail?: string; icon?: ReactNode }) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<strong>{title}</strong>{detail && <p>{detail}</p>}</div>
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  return <div className="loading-state"><LoaderCircle size={19} className="spin" />{label}</div>
}

export function InlineMessage({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' | 'success' }) {
  return <div className={`inline-message inline-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}
