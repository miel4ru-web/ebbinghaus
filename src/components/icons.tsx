// Stroke icons on a 24px grid, one consistent style. Size/colour via className
// (default 1em, currentColor).

type Props = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: '1em',
  height: '1em',
}

export function DecksIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l8 4-8 4-8-4 8-4z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 17l8 4 8-4" />
    </svg>
  )
}

export function ImportIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v12M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  )
}

export function StatsIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.7}>
      <path d="M5 20V11M12 20V5M19 20v-6" />
    </svg>
  )
}

export function SettingsIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5 8h9M18 8h1M5 16h1M11 16h8" />
      <circle cx="15.5" cy="8" r="2.3" />
      <circle cx="8.5" cy="16" r="2.3" />
    </svg>
  )
}

export function SyncIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.8}>
      <path d="M4 9a8 8 0 0113-3l3 2M20 15a8 8 0 01-13 3l-3-2" />
      <path d="M18 4v4h-4M6 20v-4h4" />
    </svg>
  )
}

export function PlusIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.9}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function EditIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.7}>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}

export function BackIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.8}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function CheckIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2.2}>
      <path d="M5 12l4 4 10-10" />
    </svg>
  )
}

export function WarnIcon({ className }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={1.8}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  )
}

export function BrandGlyph({ className }: Props) {
  return (
    <svg viewBox="0 0 28 28" fill="none" width="1em" height="1em" className={className}>
      <path d="M4 5v18h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <path
        d="M5 9C9 9 9 18 13 18C13 12 14 12 17 12C17 16 18 18 22 18"
        stroke="var(--color-brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
