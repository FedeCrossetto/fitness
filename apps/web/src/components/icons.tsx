type IconProps = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
});

export function GridIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function BrushIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M3 21c2.5 0 4-1.5 4-4 0-1.1-.9-2-2-2s-2 .9-2 2c0 1-.5 1.5-1 2 .8.5 0 2 1 2Z" />
      <path d="m10 15 8.5-8.5a2.12 2.12 0 0 0-3-3L7 12" />
    </svg>
  );
}

export function UsersIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function DumbbellIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </svg>
  );
}

export function LogOutIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SearchIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function CheckIcon({ size = 18, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 14, className }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size, className)}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}
