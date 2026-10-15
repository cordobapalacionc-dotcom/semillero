import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import { formatDay, formatNumber } from '../../lib/format';

// Mismos valores que --chart-*, --border y --muted de tokens.css. Se eligen por el tema del
// contexto (y no leyendo el CSS) porque el atributo data-theme se aplica después del render.
const PALETTES = {
  light: { c1: '#0a0a0a', c2: '#737373', c3: '#b5b5b5', grid: '#e3e3e3', muted: '#737373' },
  dark: { c1: '#f5f5f5', c2: '#8f8f8f', c3: '#4a4a4a', grid: '#262626', muted: '#8f8f8f' },
};

function useChartColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

interface TooltipPayload {
  name?: string;
  value?: number;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  labels,
  formatLabel,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  labels?: Record<string, string>;
  formatLabel?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatLabel ? formatLabel(String(label)) : label}</strong>
      {payload.map((p) => (
        <div key={String(p.dataKey)}>
          {labels?.[String(p.dataKey)] ?? p.name}: {formatNumber(Number(p.value ?? 0))}
        </div>
      ))}
    </div>
  );
}

const axisProps = (muted: string) => ({
  tick: { fill: muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

export function AreaTrend({ data, dataKey, label }: { data: { date: string }[]; dataKey: string; label: string }) {
  const colors = useChartColors();
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.c1} stopOpacity={0.18} />
              <stop offset="100%" stopColor={colors.c1} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={24} {...axisProps(colors.muted)} />
          <YAxis allowDecimals={false} {...axisProps(colors.muted)} />
          <Tooltip
            cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }}
            content={<ChartTooltip labels={{ [dataKey]: label }} formatLabel={formatDay} />}
          />
          <Area type="monotone" dataKey={dataKey} stroke={colors.c1} strokeWidth={2} fill="url(#area-fill)" activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface SeriesDef {
  key: string;
  label: string;
  style: 'solid' | 'dashed' | 'dotted';
}

// Varias series en blanco y negro: se distinguen por tono y tipo de trazo. La leyenda
// es interactiva: cada botón muestra u oculta su serie.
export function MultiLine({ data, series }: { data: { date: string }[]; series: SeriesDef[] }) {
  const colors = useChartColors();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const strokeFor = { solid: colors.c1, dashed: colors.c2, dotted: colors.c2 };
  const dashFor = { solid: undefined, dashed: '6 4', dotted: '2 3' };

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < series.length - 1) next.add(key);
      return next;
    });
  }

  return (
    <>
      <div className="chart-legend" role="group" aria-label="Series visibles">
        {series.map((s) => (
          <button
            key={s.key}
            className={`legend-item${hidden.has(s.key) ? ' off' : ''}`}
            onClick={() => toggle(s.key)}
            aria-pressed={!hidden.has(s.key)}
          >
            <span className={`legend-swatch ${s.style}`} style={{ ['--swatch' as string]: strokeFor[s.style] }} />
            {s.label}
          </button>
        ))}
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatDay} minTickGap={24} {...axisProps(colors.muted)} />
            <YAxis allowDecimals={false} {...axisProps(colors.muted)} />
            <Tooltip
              cursor={{ stroke: colors.muted, strokeDasharray: '3 3' }}
              content={<ChartTooltip labels={Object.fromEntries(series.map((s) => [s.key, s.label]))} formatLabel={formatDay} />}
            />
            {series
              .filter((s) => !hidden.has(s.key))
              .map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={strokeFor[s.style]}
                  strokeDasharray={dashFor[s.style]}
                  strokeWidth={s.style === 'dotted' ? 2.5 : 2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

export function HorizontalBars({
  data,
  label,
  onSelect,
}: {
  data: { name: string; count: number }[];
  label: string;
  onSelect?: (name: string) => void;
}) {
  const colors = useChartColors();
  const [hover, setHover] = useState<number | null>(null);
  const height = Math.max(160, data.length * 38);

  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis type="category" dataKey="name" width={110} {...axisProps(colors.muted)} />
          <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={<ChartTooltip labels={{ count: label }} />} />
          <Bar
            dataKey="count"
            radius={[0, 3, 3, 0]}
            barSize={18}
            cursor={onSelect ? 'pointer' : undefined}
            onClick={(entry: { name?: string; payload?: { name?: string } }) => {
              const name = entry?.payload?.name ?? entry?.name;
              if (name) onSelect?.(name);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={hover === null || hover === i ? colors.c1 : colors.c3}
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
