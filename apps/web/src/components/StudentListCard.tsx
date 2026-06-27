import type { TrophyRankPeriod } from '@reset-fitness/shared';
import { UserAvatar } from '@/components/UserAvatar';

export interface StudentListEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  total: number;
  currentStreak: number;
  rank: number;
}

interface PeriodOption {
  key: TrophyRankPeriod;
  label: string;
}

interface StudentListCardProps {
  entries: StudentListEntry[];
  loading?: boolean;
  title: string;
  emptyMessage: string;
  period: TrophyRankPeriod;
  periodOptions: PeriodOption[];
  onPeriodChange: (period: TrophyRankPeriod) => void;
  formatCount: (n: number) => string;
  formatStreak: (n: number) => string;
  onStudentClick: (userId: string) => void;
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

export function StudentListCard({
  entries,
  loading,
  title,
  emptyMessage,
  period,
  periodOptions,
  onPeriodChange,
  formatCount,
  formatStreak,
  onStudentClick,
  onSeeAll,
}: StudentListCardProps): React.JSX.Element {
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
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : entries.length === 0 ? (
        <p className="muted stl-empty">{emptyMessage}</p>
      ) : (
        entries.slice(0, 8).map((entry) => (
          <button
            key={entry.userId}
            type="button"
            className="stl-row"
            onClick={() => onStudentClick(entry.userId)}
          >
            <span className="stl-rank">#{entry.rank}</span>
            <UserAvatar name={entry.name} url={entry.avatarUrl} size="md" />
            <div className="stl-info">
              <span className="stl-name">{entry.name}</span>
              {entry.currentStreak >= 2 ? (
                <span className="stl-streak">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 23c-3.9-1.5-6.5-4.4-7.8-8.6C2.4 10.2 4.2 5.6 8.2 4c1.1 3.1 3.3 5.2 6.3 6.3-1.5-4.2.3-8.8 4.5-10.5 4.5 2.8 5.8 8.2 3.1 12.5C20.2 15.8 16.8 20.2 12 23z" />
                  </svg>
                  {formatStreak(entry.currentStreak)}
                </span>
              ) : (
                <span className="stl-sub">—</span>
              )}
            </div>
            <div className="stl-meta">
              <span className="stl-count">
                <img src="/trophy.png" alt="" className="stl-count-icon" />
                {formatCount(entry.total)}
              </span>
              <span className="stl-label">trofeos</span>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
