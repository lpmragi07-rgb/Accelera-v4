"use client";

import { useId } from "react";

export interface ComparisonBar {
  id: string;
  label: string;
  value: number;
  /** Campanha "principal" do relatório — vermelho (accent). */
  highlight?: boolean;
  /** Segunda campanha escolhida para comparação direta — azul (sky). */
  compareActive?: boolean;
}

interface CampaignComparisonChartProps {
  bars: ComparisonBar[];
  height?: number;
  /** Quando presente, as barras ficam clicáveis (ex.: escolher a 2ª campanha). */
  onBarClick?: (id: string) => void;
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

// Barras editoriais no tema V4: campanha principal em vermelho (accent),
// a segunda campanha de comparação em azul (sky), as demais em tom neutro.
export default function CampaignComparisonChart({ bars, height = 260, onBarClick }: CampaignComparisonChartProps) {
  const gradientId = useId();

  if (bars.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center text-sm text-ink-muted" style={{ height }}>
        <p>Ainda não há outras campanhas para comparar.</p>
        <p className="text-xs">Crie mais campanhas para ver o desempenho de cada uma lado a lado.</p>
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
        <linearGradient id={`${gradientId}-compare`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity={1} />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.55} />
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
        const fill = bar.highlight
          ? `url(#${gradientId}-highlight)`
          : bar.compareActive
          ? `url(#${gradientId}-compare)`
          : `url(#${gradientId}-base)`;
        const textTone = bar.highlight ? "fill-accent" : bar.compareActive ? "fill-sky-400" : "fill-ink";
        const clickable = Boolean(onBarClick);

        return (
          <g
            key={bar.id}
            onClick={clickable ? () => onBarClick?.(bar.id) : undefined}
            className={clickable ? "cursor-pointer" : undefined}
          >
            {clickable && (
              <rect x={x} y={PAD_TOP} width={barWidth} height={plotHeight} fill="transparent" />
            )}
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={8} fill={fill} />
            {(bar.highlight || bar.compareActive) && (
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={8}
                fill="none"
                stroke={bar.highlight ? "#EC1C24" : "#38BDF8"}
                strokeWidth={2}
              />
            )}
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className={`${textTone} font-semibold`} fontSize={12}>
              {bar.value.toLocaleString("pt-BR")}
            </text>
            <text
              x={x + barWidth / 2}
              y={PAD_TOP + plotHeight + 20}
              textAnchor="middle"
              className={`${textTone} ${bar.highlight || bar.compareActive ? "font-semibold" : ""}`}
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
