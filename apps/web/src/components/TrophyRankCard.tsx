import type { TrophyRankPeriod } from '@reset-fitness/shared';
import { UserAvatar } from '@/components/UserAvatar';

export interface TrophyRankEntry {
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

interface TrophyRankCardProps {
  entries: TrophyRankEntry[];
  loading?: boolean;
  title: string;
  subtitle: string;
  emptyMessage: string;
  period: TrophyRankPeriod;
  periodOptions: PeriodOption[];
  onPeriodChange: (period: TrophyRankPeriod) => void;
  formatCount: (n: number) => string;
  formatStreak: (n: number) => string;
  onStudentClick: (userId: string) => void;
}

const PODIUM_ORDER = [1, 0, 2] as const;
const PODIUM_CLASS = ['trophy-podium-slot--first', 'trophy-podium-slot--second', 'trophy-podium-slot--third'] as const;

function TrophyCount({ count, formatCount }: { count: number; formatCount: (n: number) => string }): React.JSX.Element {
  return (
    <span className="trophy-rank-count">
      <img src="/trophy.png" alt="" className="trophy-rank-count-icon" />
      <span>{formatCount(count)}</span>
    </span>
  );
}

function StreakBadge({ streak, formatStreak }: { streak: number; formatStreak: (n: number) => string }): React.JSX.Element | null {
  if (streak < 2) return null;
  return (
    <span className="trophy-rank-streak" title={formatStreak(streak)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 23c-3.9-1.5-6.5-4.4-7.8-8.6C2.4 10.2 4.2 5.6 8.2 4c1.1 3.1 3.3 5.2 6.3 6.3-1.5-4.2.3-8.8 4.5-10.5 4.5 2.8 5.8 8.2 3.1 12.5C20.2 15.8 16.8 20.2 12 23z" />
      </svg>
      {formatStreak(streak)}
    </span>
  );
}

export function TrophyRankCard({
  entries,
  loading,
  title,
  subtitle,
  emptyMessage,
  period,
  periodOptions,
  onPeriodChange,
  formatCount,
  formatStreak,
  onStudentClick,
}: TrophyRankCardProps): React.JSX.Element {
  const leaderTotal = entries[0]?.total ?? 0;
  const hasTrophies = leaderTotal > 0;
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  return (
    <div className="card dash-trophy-rank">
      <div className="dash-trophy-rank-header">
        <div className="dash-trophy-rank-heading">
          <div className="dash-trophy-rank-title-row">
            <div>
              <div className="dash-trophy-rank-title">{title}</div>
              <div className="dash-trophy-rank-sub">{subtitle}</div>
            </div>
            <img src="/trophy.png" alt="" className="dash-trophy-rank-mark" />
          </div>
          <div className="segmented trophy-rank-period">
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
      </div>

      {loading ? (
        <div className="trophy-rank-skeleton">
          <div className="trophy-rank-skeleton-podium" />
          <div className="trophy-rank-skeleton-row" />
          <div className="trophy-rank-skeleton-row" />
        </div>
      ) : !hasTrophies ? (
        <p className="muted dash-trophy-rank-empty">{emptyMessage}</p>
      ) : (
        <>
          {podium.length > 0 ? (
            <div className="trophy-podium">
              {PODIUM_ORDER.map((slotIdx, visualIdx) => {
                const entry = podium[slotIdx];
                if (!entry) {
                  return <div key={`empty-${visualIdx}`} className="trophy-podium-slot trophy-podium-slot--empty" />;
                }
                return (
                  <button
                    key={entry.userId}
                    type="button"
                    className={`trophy-podium-slot ${PODIUM_CLASS[slotIdx]}`}
                    onClick={() => onStudentClick(entry.userId)}
                  >
                    <span className="trophy-podium-rank">#{entry.rank}</span>
                    <UserAvatar name={entry.name} url={entry.avatarUrl} size="md" />
                    <span className="trophy-podium-name">{entry.name}</span>
                    <TrophyCount count={entry.total} formatCount={formatCount} />
                    <StreakBadge streak={entry.currentStreak} formatStreak={formatStreak} />
                    <span className="trophy-podium-bar" />
                  </button>
                );
              })}
            </div>
          ) : null}

          {rest.length > 0 ? (
            <div className="trophy-rank-list">
              {rest.map((entry) => (
                <button
                  key={entry.userId}
                  type="button"
                  className="trophy-rank-row"
                  onClick={() => onStudentClick(entry.userId)}
                >
                  <span className="trophy-rank-pos">{entry.rank}</span>
                  <UserAvatar name={entry.name} url={entry.avatarUrl} size="sm" />
                  <span className="trophy-rank-name">{entry.name}</span>
                  <StreakBadge streak={entry.currentStreak} formatStreak={formatStreak} />
                  <div className="trophy-rank-bar-wrap">
                    <span
                      className="trophy-rank-bar-fill"
                      style={{ width: `${leaderTotal > 0 ? Math.max(8, (entry.total / leaderTotal) * 100) : 0}%` }}
                    />
                  </div>
                  <TrophyCount count={entry.total} formatCount={formatCount} />
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
