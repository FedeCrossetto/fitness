export function AreaChart({ values, height = 120 }: { values: number[]; height?: number }): React.JSX.Element {
  const w = 320;
  const h = height;
  const pad = 6;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : w;
  const pts = values.map((v, i) => [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const last = pts[pts.length - 1];
  const gid = `ac-${values.join('-').slice(0, 12)}`;
  return (
    <svg className="area-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.10)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} className="grid-line" x1={0} x2={w} y1={h * g} y2={h * g} />
      ))}
      <path className="area" d={area} fill={`url(#${gid})`} />
      <path className="line" d={line} vectorEffect="non-scaling-stroke" />
      <circle className="dot" cx={last[0]} cy={last[1]} r={3.5} />
    </svg>
  );
}

export function Ring({ pct, size = 116, label }: { pct: number; size?: number; label?: string }): React.JSX.Element {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c * (1 - clamped / 100);
  return (
    <div className="ring-wrap">
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
        <text
          className="ring-center"
          x="50%"
          y="50%"
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

export function Bars({ values, labels }: { values: number[]; labels: string[] }): React.JSX.Element {
  const max = Math.max(...values, 1);
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
