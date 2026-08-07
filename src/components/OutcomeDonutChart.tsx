"use client";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// Donut via conic-gradient (CSS puro) — mais simples que arcos SVG e imprime bem.
export default function OutcomeDonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
        Sem qualificações registradas no dia.
      </div>
    );
  }

  let cumulative = 0;
  const stops = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (cumulative / total) * 360;
      cumulative += s.value;
      const end = (cumulative / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-3 flex items-center justify-center rounded-full bg-paper">
          <div className="text-center">
            <p className="font-serif text-3xl font-semibold leading-none tabular-nums">{total}</p>
            <p className="mt-1 text-[0.6rem] uppercase tracking-eyebrow text-ink-muted">Qualificados</p>
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-ink-muted">{s.label}</span>
            <span className="font-semibold tabular-nums text-ink">{s.value}</span>
            <span className="text-xs tabular-nums text-ink-muted">
              ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
