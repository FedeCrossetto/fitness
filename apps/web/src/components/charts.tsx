import { useEffect, useId, useRef, useState } from 'react';

/** Mide el ancho real del contenedor para que el chart llene pantallas anchas sin distorsión. */
function useElementWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// ── Smooth bezier path (Catmull-Rom → Cubic Bézier) ─────────────────────────

function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0]![0]},${pts[0]![1]}`;

  const d: string[] = [`M${pts[0]![0].toFixed(2)},${pts[0]![1].toFixed(2)}`];

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(i + 2, pts.length - 1)]!;
    const t  = 0.45;

    const cp1x = p1[0] + (p2[0] - p0[0]) * t / 3;
    const cp1y = p1[1] + (p2[1] - p0[1]) * t / 3;
    const cp2x = p2[0] - (p3[0] - p1[0]) * t / 3;
    const cp2y = p2[1] - (p3[1] - p1[1]) * t / 3;

    d.push(`C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`);
  }
  return d.join(' ');
}

// ── AreaChart ────────────────────────────────────────────────────────────────

interface AreaChartProps {
  values: number[];
  height?: number;
  color?: string;
}

export function AreaChart({ values, height = 140, color = '#6366f1' }: AreaChartProps): React.JSX.Element {
  const uid  = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, W] = useElementWidth(600);

  const H   = height;
  const padT = 12;
  const padB = 6;

  const nonZero = values.some((v) => v > 0);
  const max  = Math.max(...values, 1);
  const span = max || 1;

  const step = values.length > 1 ? W / (values.length - 1) : W;

  const pts: [number, number][] = values.map((v, i) => [
    i * step,
    H - padB - (v / span) * (H - padT - padB),
  ]);

  const linePath = smoothPath(pts);
  const lastPt   = pts[pts.length - 1]!;
  const areaPath = `${linePath} L${lastPt[0]},${H} L0,${H} Z`;

  const hPt  = hover !== null ? pts[hover] : null;
  const hVal = hover !== null ? (values[hover] ?? 0) : 0;

  // Clamp tooltip X so it doesn't overflow
  const ttW  = 48;
  const ttX  = hPt ? Math.max(ttW / 2, Math.min(W - ttW / 2, hPt[0])) : 0;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height, display: 'block', overflow: 'visible', cursor: 'crosshair' }}
      onMouseLeave={() => setHover(null)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="80%"  stopColor={color} stopOpacity="0.04" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Subtle horizontal grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={0} x2={W}
          y1={padT + g * (H - padT - padB)}
          y2={padT + g * (H - padT - padB)}
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}

      {nonZero && (
        <>
          {/* Gradient fill */}
          <path d={areaPath} fill={`url(#${uid}-fill)`} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${uid}-line)`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover: vertical rule */}
          {hPt && (
            <line
              x1={hPt[0]} x2={hPt[0]}
              y1={padT} y2={H}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.35}
            />
          )}

          {/* Hover: dot */}
          {hPt && (
            <>
              <circle cx={hPt[0]} cy={hPt[1]} r={8} fill={color} opacity={0.12} />
              <circle cx={hPt[0]} cy={hPt[1]} r={4.5} fill="white" stroke={color} strokeWidth={2.5} />
              {/* Tooltip bubble */}
              <rect
                x={ttX - ttW / 2} y={hPt[1] - 36}
                width={ttW} height={22}
                rx={6}
                fill="var(--text-primary)"
              />
              <text
                x={ttX} y={hPt[1] - 21}
                textAnchor="middle"
                fontSize={12}
                fontWeight={700}
                fill="white"
                fontFamily="inherit"
              >
                {hVal}
              </text>
              {/* Tooltip arrow */}
              <polygon
                points={`${ttX - 5},${hPt[1] - 15} ${ttX + 5},${hPt[1] - 15} ${ttX},${hPt[1] - 8}`}
                fill="var(--text-primary)"
              />
            </>
          )}

          {/* Last point — always visible */}
          {hover === null && (
            <>
              <circle cx={lastPt[0]} cy={lastPt[1]} r={6} fill={color} opacity={0.15} />
              <circle cx={lastPt[0]} cy={lastPt[1]} r={3.5} fill="white" stroke={color} strokeWidth={2.5} />
            </>
          )}

          {/* Invisible hit areas per data point */}
          {pts.map((pt, i) => {
            const hw = step / 2;
            return (
              <rect
                key={i}
                x={Math.max(0, pt[0] - hw)}
                width={i === 0 || i === pts.length - 1 ? hw : step}
                y={0} height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            );
          })}
        </>
      )}

      {/* Empty state baseline */}
      {!nonZero && (
        <line
          x1={0} x2={W}
          y1={H - padB} y2={H - padB}
          stroke="var(--border-strong)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}
    </svg>
    </div>
  );
}

// ── Ring ─────────────────────────────────────────────────────────────────────

export function Ring({ pct, size = 116, label }: { pct: number; size?: number; label?: string }): React.JSX.Element {
  const stroke  = 10;
  const r       = (size - stroke) / 2;
  const c       = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset  = c * (1 - clamped / 100);
  return (
    <div className="ring-wrap">
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="value"
          cx={size / 2} cy={size / 2} r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <text
          className="ring-center"
          x="50%" y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          transform={`rotate(90 ${size / 2} ${size / 2})`}
          fill="var(--text-primary)"
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      {label ? <span className="stat-foot">{label}</span> : null}
    </div>
  );
}

// ── Bars ─────────────────────────────────────────────────────────────────────

export function Bars({ values, labels }: { values: number[]; labels: string[] }): React.JSX.Element {
  const max     = Math.max(...values, 1);
  const tallest = values.indexOf(Math.max(...values));
  return (
    <div>
      <div className="bars">
        {values.map((v, i) => (
          <div
            key={i}
            className={`bar${i === tallest ? ' tall' : ''}`}
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="bar-labels">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}
