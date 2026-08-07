"use client";

import { useId } from "react";

export interface TrendPoint {
  date: string;
  value: number;
}

const WIDTH = 800;
const PAD_X = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 24;

function formatDay(d: string): string {
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Linha simples de tendência (sem hover) — contexto de 7 dias ao lado do
// instantâneo do dia, sem competir visualmente com os gráficos principais.
export default function MiniTrendChart({ points, height = 150 }: { points: TrendPoint[]; height?: number }) {
  const gradientId = useId();

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-ink-muted" style={{ height }}>
        Sem dados no período.
      </div>
    );
  }

  const maxValue = Math.max(1, ...points.map((p) => p.value));
  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const xFor = (i: number) => PAD_X + (points.length <= 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(points.length - 1)} ${PAD_TOP + plotHeight} L ${xFor(0)} ${PAD_TOP + plotHeight} Z`;
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EC1C24" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#EC1C24" stopOpacity={0} />
        </linearGradient>
      </defs>

      <line
        x1={PAD_X}
        x2={WIDTH - PAD_X}
        y1={PAD_TOP + plotHeight}
        y2={PAD_TOP + plotHeight}
        stroke="#F5F5F6"
        strokeOpacity={0.1}
      />

      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path d={linePath} fill="none" stroke="#EC1C24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <circle key={p.date} cx={xFor(i)} cy={yFor(p.value)} r={i === points.length - 1 ? 4.5 : 3} fill="#EC1C24" />
      ))}

      <text x={xFor(points.length - 1)} y={yFor(last.value) - 10} textAnchor="end" className="fill-ink font-semibold" fontSize={12}>
        {last.value}
      </text>

      {points.map((p, i) => (
        <text key={`label-${p.date}`} x={xFor(i)} y={height - 6} textAnchor="middle" className="fill-ink-muted" fontSize={10}>
          {formatDay(p.date)}
        </text>
      ))}
    </svg>
  );
}
