import type { ReactNode } from 'react'
import { CloseIcon, WarnIcon } from './icons'

// Shared button class strings — utility-first, no wrapper component so callers keep
// full control of type/onClick/disabled.
const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
export const btnDefault = `${btn} border-border bg-surface-2 text-text hover:border-text-dim`
export const btnAccent = `${btn} border-brand bg-brand font-semibold text-on-brand hover:bg-brand-light`
export const btnGhost = `${btn} border-transparent text-text-dim hover:bg-surface-2 hover:text-text`

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline px-5 py-6 md:px-8 md:py-8">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-text-dim">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Callout({
  children,
  tone = 'info',
  className = '',
}: {
  children: ReactNode
  tone?: 'info' | 'warn'
  className?: string
}) {
  const warn = tone === 'warn'
  return (
    <div
      className={`flex gap-2.5 rounded-lg border p-3 text-xs leading-relaxed ${
        warn
          ? 'border-again/30 bg-again/10 text-again'
          : 'border-hairline bg-surface-2 text-text-dim'
      } ${className}`}
    >
      {warn && (
        <span className="mt-px shrink-0 text-again">
          <WarnIcon className="text-[15px]" />
        </span>
      )}
      <div>{children}</div>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-text-dim hover:bg-surface-2 hover:text-text"
          >
            <CloseIcon className="text-base" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 border-t border-hairline bg-bg px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}
