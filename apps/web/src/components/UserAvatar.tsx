import { resolveAvatarUrl, initials } from '@/lib/avatarUrl';

interface UserAvatarProps {
  name?: string | null;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

const SIZE_PX: Record<NonNullable<UserAvatarProps['size']>, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

export function UserAvatar({ name, url, size = 'sm', className = 'avatar', style }: UserAvatarProps): React.JSX.Element {
  const resolved = resolveAvatarUrl(url);
  const px = SIZE_PX[size];
  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    minWidth: px,
    ...(resolved ? { padding: 0, overflow: 'hidden' } : {}),
    ...style,
  };

  if (resolved) {
    return (
      <span className={className} style={baseStyle}>
        <img
          src={resolved}
          alt={name ?? ''}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  return (
    <span className={className} style={baseStyle}>
      {initials(name)}
    </span>
  );
}

export function GroupAvatar({
  name,
  url,
  size = 'md',
  className,
}: {
  name?: string | null;
  url?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): React.JSX.Element {
  const resolved = resolveAvatarUrl(url);
  const px = SIZE_PX[size];

  if (resolved) {
    return (
      <span
        className={className ?? 'avatar'}
        style={{ width: px, height: px, padding: 0, overflow: 'hidden', borderRadius: 14, display: 'inline-flex' }}
      >
        <img
          src={resolved}
          alt={name ?? 'Grupo'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </span>
    );
  }

  return (
    <span
      className={className ?? 'gd-avatar-fallback'}
      style={{
        width: px,
        height: px,
        borderRadius: 14,
        background: 'var(--surface-elevated)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size === 'lg' ? 20 : 14,
        color: 'var(--primary)',
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  );
}
