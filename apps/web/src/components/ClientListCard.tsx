import React from 'react';
import type { TrophyRankPeriod } from '@reset-fitness/shared';
import { UserAvatar } from '@/components/UserAvatar';

export interface ClientListEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  total: number;
  currentStreak: number;
  rank: number;
  /** Info uniforme bajo el nombre (ej: objetivo del alumno). */
  subtitle?: string | null;
}

interface PeriodOption {
  key: TrophyRankPeriod;
  label: string;
}

interface ClientListCardProps {
  entries: ClientListEntry[];
  loading?: boolean;
  title: string;
  emptyMessage: string;
  period: TrophyRankPeriod;
  periodOptions: PeriodOption[];
  onPeriodChange: (period: TrophyRankPeriod) => void;
  formatCount?: (n: number) => string;
  formatStreak?: (n: number) => string;
  onClientClick: (userId: string) => void;
  onSeeAll?: () => void;
}

function SkeletonRow(): React.JSX.Element {
  return (
    <div className="stl-row stl-row--skeleton">
      <div className="stl-skeleton-avatar" />
      <div className="stl-skeleton-info">
        <div className="stl-skeleton-line stl-skeleton-line--name" />
        <div className="stl-skeleton-line stl-skeleton-line--sub" />
      </div>
      <div className="stl-skeleton-value" />
    </div>
  );
}

export function ClientListCard({
  entries,
  loading,
  title,
  emptyMessage,
  period,
  periodOptions,
  onPeriodChange,
  onClientClick,
  onSeeAll,
}: ClientListCardProps): React.JSX.Element {
  return (
    <div className="card stl-card">
      {/* Header */}
      <div className="stl-header">
        <div className="stl-header-left">
          <span className="stl-title">{title}</span>
          <div className="segmented stl-period">
            {periodOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={period === opt.key ? 'active' : ''}
                onClick={() => onPeriodChange(opt.key)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {onSeeAll ? (
          <span className="section-link" onClick={onSeeAll}>
            Ver todos
          </span>
        ) : null}
      </div>

      {/* Body */}
      {loading ? (
        <div className="stl-list">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : entries.length === 0 ? (
        <p className="muted stl-empty">{emptyMessage}</p>
      ) : (
        <div className="stl-list">
          {entries.slice(0, 8).map((entry) => (
            <button
              key={entry.userId}
              type="button"
              className="stl-row"
              onClick={() => onClientClick(entry.userId)}
            >
              <UserAvatar name={entry.name} url={entry.avatarUrl} size="md" />
              <div className="stl-info">
                <span className="stl-name">{entry.name}</span>
                <span className="stl-sub">{entry.subtitle || '—'}</span>
              </div>
              <div className="stl-meta">
                <span className="stl-count">
                  <img src="/trophy.png" alt="" className="stl-count-icon" />
                  {entry.total}
                </span>
                <span className="stl-label">{entry.total === 1 ? 'trofeo' : 'trofeos'}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
