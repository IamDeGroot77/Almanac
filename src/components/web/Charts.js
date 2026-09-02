import { colors } from '../../theme';

// Small dependency-free SVG charts for the laptop dashboard. Each takes plain
// arrays and draws with the theme palette.

export function BarChart({ data, width = 480, height = 180, valueLabel = (v) => String(v), color = colors.accent }) {
  // data: [{ label, value, hint? }]
  const max = Math.max(1, ...data.map((d) => d.value));
  const pad = { l: 8, r: 8, t: 8, b: 28 };
  const w = (width - pad.l - pad.r) / Math.max(1, data.length);
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      {data.map((d, i) => {
        const h = ((height - pad.t - pad.b) * d.value) / max;
        const x = pad.l + i * w;
        return (
          <g key={i}>
            <rect x={x + w * 0.15} y={height - pad.b - h} width={w * 0.7} height={h} rx={4} fill={d.color || color}>
              <title>{d.hint || `${d.label}: ${valueLabel(d.value)}`}</title>
            </rect>
            <text x={x + w / 2} y={height - pad.b - h - 4} textAnchor="middle" fontSize={11} fill={colors.muted}>
              {d.value ? valueLabel(d.value) : ''}
            </text>
            <text x={x + w / 2} y={height - 10} textAnchor="middle" fontSize={11} fill={colors.muted}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, width = 480, height = 180, yLabel = (v) => String(v), baseline = null }) {
  // points: [{ x: label, y: number, hint? }]
  if (points.length === 0) return null;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const ys = points.map((p) => p.y);
  const max = Math.max(...ys, baseline ?? -Infinity) * 1.1 || 1;
  const min = Math.min(0, ...ys);
  const sx = (i) => pad.l + (i * (width - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const sy = (v) => height - pad.b - ((v - min) * (height - pad.t - pad.b)) / (max - min || 1);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(p.y)}`).join(' ');
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      {baseline != null ? (
        <g>
          <line x1={pad.l} x2={width - pad.r} y1={sy(baseline)} y2={sy(baseline)} stroke={colors.line} strokeDasharray="4 4" />
          <text x={pad.l - 4} y={sy(baseline) + 4} textAnchor="end" fontSize={10} fill={colors.muted}>
            {yLabel(baseline)}
          </text>
        </g>
      ) : null}
      <path d={path} fill="none" stroke={colors.accent} strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(p.y)} r={3.5} fill={colors.accent}>
            <title>{p.hint || `${p.x}: ${yLabel(p.y)}`}</title>
          </circle>
          {points.length <= 14 || i % Math.ceil(points.length / 10) === 0 ? (
            <text x={sx(i)} y={height - 10} textAnchor="middle" fontSize={10} fill={colors.muted}>
              {p.x}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function Scatter({ points, width = 480, height = 200, xLabel = 'x', yLabel = 'y' }) {
  // points: [{ x, y, hint }]
  if (points.length === 0) return null;
  const pad = { l: 40, r: 12, t: 12, b: 32 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [xmin, xmax] = [Math.min(...xs), Math.max(...xs)];
  const [ymin, ymax] = [Math.min(0, ...ys), Math.max(...ys) || 1];
  const sx = (v) => pad.l + ((v - xmin) * (width - pad.l - pad.r)) / (xmax - xmin || 1);
  const sy = (v) => height - pad.b - ((v - ymin) * (height - pad.t - pad.b)) / (ymax - ymin || 1);
  return (
    <svg width={width} height={height} style={{ maxWidth: '100%' }}>
      <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} stroke={colors.line} />
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={height - pad.b} stroke={colors.line} />
      <text x={width - pad.r} y={height - 8} textAnchor="end" fontSize={10} fill={colors.muted}>
        {xLabel}
      </text>
      <text x={pad.l + 4} y={pad.t + 8} fontSize={10} fill={colors.muted}>
        {yLabel}
      </text>
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill={colors.accent} opacity={0.75}>
          <title>{p.hint}</title>
        </circle>
      ))}
    </svg>
  );
}
