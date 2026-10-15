import { useEffect, useRef, useState } from 'react';
import { formatNumber } from '../../lib/format';
import { Icon } from './Icon';
import type { IconName } from './Icon';

const DURATION_MS = 600;

function useCountUp(target: number) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

interface StatCardProps {
  label: string;
  value: number;
  icon?: IconName;
  delta?: number | null;
  deltaLabel?: string;
}

export function StatCard({ label, value, icon, delta, deltaLabel = 'vs. periodo anterior' }: StatCardProps) {
  const shown = useCountUp(value);
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <Icon name={icon} size={16} />}
      </div>
      <strong className="stat-value">{formatNumber(shown)}</strong>
      {delta !== undefined && (
        <span className="stat-delta" title={deltaLabel}>
          {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`} <span className="muted">{deltaLabel}</span>
        </span>
      )}
    </div>
  );
}
