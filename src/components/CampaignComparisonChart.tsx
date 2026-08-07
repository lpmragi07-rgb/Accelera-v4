"use client";

import { useId, useState } from "react";

export interface ComparisonBar {
  id: string;
  label: string;
  value: number;
  /** Campanha/operador "principal" do relatório — vermelho (accent). */
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
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 24;
const PAD_BOTTOM = 44;
const BAR_GAP = 20;
const BAR_RADIUS = 10;
const GRID_LINES = [0, 0.25, 0.5, 0.75, 1];

function truncate(label: string, max = 15): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

// Retângulo com cantos arredondados só em cima — assenta "de verdade" na
// linha de base, em vez do rx padrão arredondando os 4 cantos.
function topRoundedRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    "Z",
  ].join(" ");
}

// Barras editoriais no tema V4: campanha/operador principal em vermelho
// (accent), a comparação em azul (sky), as demais num gradiente neutro —
// com grade de escala, tooltip no hover (nome completo) e estado vazio
// tratado (nada de barras fantasma quando está tudo zerado).
export default function CampaignComparisonChart({ bars, height = 260, onBarClick }: CampaignComparisonChartProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalValue = bars.reduce((sum, b) => sum + b.value, 0);

  if (bars.length <= 1) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center text-sm text-ink-muted" style={{ height }}>
        <p>Ainda não há outras campanhas para comparar.</p>
        <p className="text-xs">Crie mais campanhas para ver o desempenho de cada uma lado a lado.</p>
      </div>
    );
  }

  if (totalValue === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 text-center text-sm text-ink-muted" style={{ height }}>
        <p>Ainda sem dados suficientes nesse período.</p>
        <p className="text-xs">O gráfico aparece assim que houver alguma qualificação registrada.</p>
      </div>
    );
  }

  const maxValue = Math.max(1, ...bars.map((b) => b.value));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = height - PAD_TOP - PAD_BOTTOM;
  const barWidth = (plotWidth - BAR_GAP * (bars.length - 1)) / bars.length;
  const baseline = PAD_TOP + plotHeight;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="h-auto w-full overflow-visible"
      onMouseLeave={() => setHoverIndex(null)}
    >
      <defs>
        <linearGradient id={`${gradientId}-highlight`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF4A52" stopOpacity={1} />
          <stop offset="100%" stopColor="#EC1C24" stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id={`${gradientId}-compare`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5CCBFB" stopOpacity={1} />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id={`${gradientId}-base`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5F5F6" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#F5F5F6" stopOpacity={0.16} />
        </linearGradient>
      </defs>

      {/* Grade de escala */}
      {GRID_LINES.map((g) => {
        const y = PAD_TOP + plotHeight * (1 - g);
        return (
          <g key={g}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke="#F5F5F6"
              strokeOpacity={g === 0 ? 0.16 : 0.06}
            />
            <text x={PAD_LEFT - 10} y={y + 3} textAnchor="end" className="fill-ink-muted" fontSize={10}>
              {Math.round(maxValue * g).toLocaleString("pt-BR")}
            </text>
          </g>
        );
      })}

      {bars.map((bar, i) => {
        const x = PAD_LEFT + i * (barWidth + BAR_GAP);
        const barHeight = Math.max(3, (bar.value / maxValue) * plotHeight);
        const y = baseline - barHeight;
        const fill = bar.highlight
          ? `url(#${gradientId}-highlight)`
          : bar.compareActive
          ? `url(#${gradientId}-compare)`
          : `url(#${gradientId}-base)`;
        const stroke = bar.highlight ? "#EC1C24" : bar.compareActive ? "#38BDF8" : "none";
        const textTone = bar.highlight ? "fill-accent" : bar.compareActive ? "fill-sky-400" : "fill-ink";
        const clickable = Boolean(onBarClick);
        const hovered = hoverIndex === i;

        return (
          <g
            key={bar.id}
            onClick={clickable ? () => onBarClick?.(bar.id) : undefined}
            onMouseEnter={() => setHoverIndex(i)}
            className={clickable ? "cursor-pointer" : undefined}
          >
            {/* Área de detecção de hover/clique cobre a coluna inteira, não só a barra */}
            <rect x={x} y={PAD_TOP} width={barWidth} height={plotHeight} fill="transparent" />

            <path
              d={topRoundedRectPath(x, y, barWidth, barHeight, BAR_RADIUS)}
              fill={fill}
              stroke={stroke}
              strokeWidth={stroke === "none" ? 0 : 2}
              opacity={hovered ? 1 : 0.94}
              className="transition-opacity duration-150"
            />

            <text
              x={x + barWidth / 2}
              y={y - 10}
              textAnchor="middle"
              className={`${textTone} font-semibold transition-opacity ${hovered ? "opacity-100" : "opacity-90"}`}
              fontSize={13}
            >
              {bar.value.toLocaleString("pt-BR")}
            </text>
            <text
              x={x + barWidth / 2}
              y={baseline + 20}
              textAnchor="middle"
              className={bar.highlight || bar.compareActive ? `${textTone} font-semibold` : "fill-ink-muted"}
              fontSize={11}
            >
              {truncate(bar.label)}
            </text>

            {/* Tooltip no hover: nome completo (a legenda embaixo é truncada) */}
            {hovered && (
              <ChartTooltip x={x + barWidth / 2} y={y - 26} label={bar.label} value={bar.value} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ChartTooltip({ x, y, label, value }: { x: number; y: number; label: string; value: number }) {
  const width = Math.min(260, Math.max(90, label.length * 6.5 + 24));
  const boxX = Math.min(Math.max(x - width / 2, 4), WIDTH - width - 4);

  return (
    <g pointerEvents="none">
      <rect x={boxX} y={y - 30} width={width} height={26} rx={8} fill="#09090B" stroke="#F5F5F6" strokeOpacity={0.12} />
      <text x={boxX + width / 2} y={y - 12} textAnchor="middle" className="fill-ink" fontSize={11}>
        {label} · {value.toLocaleString("pt-BR")}
      </text>
    </g>
  );
}
