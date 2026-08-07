"use client";

import { useId } from "react";

export interface ComparisonBar {
  label: string;
  value: number;
  highlight?: boolean;
}

interface CampaignComparisonChartProps {
  bars: ComparisonBar[];
  height?: number;
}

const WIDTH = 800;
const PAD_LEFT = 16;
const PAD_RIGHT = 16;
const PAD_TOP = 28;
const PAD_BOTTOM = 40;
const BAR_GAP = 18;

function truncate(label: string, max = 16): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Barras editoriais no tema V4: campanha selecionada em vermelho (accent),
// as demais em tom neutro (ink), mesma linguagem visual do resto do painel.
export default function CampaignComparisonChart({ bars, height = 260 }: CampaignComparisonChartProps) {
  const gradientId = useId();

  if (bars.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-ink-muted" style={{ height }}>
        Sem outras campanhas para comparar.
      </div>
    );
  }

  const maxValue = Math.max(1, ...bars.map((b) => b.value));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const barWidth = (plotWidth - BAR_GAP * (bars.length - 1)) / bars.length;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full overflow-visible">
      <defs>
        <linearGradient id={`${gradientId}-highlight`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EC1C24" stopOpacity={1} />
          <stop offset="100%" stopColor="#EC1C24" stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={`${gradientId}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5F5F6" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#F5F5F6" stopOpacity={0.12} />
        </linearGradient>
      </defs>

      <line
        x1={PAD_LEFT}
        x2={WIDTH - PAD_RIGHT}
        y1={PAD_TOP + plotHeight}
        y2={PAD_TOP + plotHeight}
        stroke="#F5F5F6"
        strokeOpacity={0.1}
        strokeWidth={1}
      />

      {bars.map((bar, i) => {
        const x = PAD_LEFT + i * (barWidth + BAR_GAP);
        const barHeight = Math.max(2, (bar.value / maxValue) * plotHeight);
        const y = PAD_TOP + plotHeight - barHeight;
        const fill = bar.highlight ? `url(#${gradientId}-highlight)` : `url(#${gradientId}-base)`;

        return (
          <g key={`${bar.label}-${i}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={fill} />
            {bar.highlight && (
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill="none" stroke="#EC1C24" strokeWidth={2} />
            )}
            <text
              x={x + barWidth / 2}
              y={y - 8}
              textAnchor="middle"
              className={bar.highlight ? "fill-accent font-bold" : "fill-ink font-semibold"}
              fontSize={12}
            >
              {bar.value.toLocaleString("pt-BR")}
            </text>
            <text
              x={x + barWidth / 2}
              y={PAD_TOP + plotHeight + 20}
              textAnchor="middle"
              className={bar.highlight ? "fill-accent font-semibold" : "fill-ink-muted"}
              fontSize={11}
            >
              {truncate(bar.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
