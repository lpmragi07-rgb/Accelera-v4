"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PhoneOutgoing,
  PhoneForwarded,
  Voicemail,
  PhoneOff,
  Check,
  Square,
  X,
  Percent,
  Printer,
  Trophy,
  Loader2,
  PieChart,
  TrendingUp,
  Users,
  Building2,
  Phone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "./Navbar";
import Footer from "./Footer";
import CampaignComparisonChart from "./CampaignComparisonChart";
import OutcomeDonutChart from "./OutcomeDonutChart";
import MiniTrendChart from "./MiniTrendChart";
import StatusBadge from "./StatusBadge";
import type { Campaign, Operator, LeadStatus, LeadOutcome } from "@/types/database";

// Recorte de "leads" só com as colunas usadas nos agregados do relatório —
// mais leve que carregar a linha inteira (gravação, notas etc. não importam aqui).
interface DayLeadRow {
  id: string;
  campaign_id: string;
  operator_id: string | null;
  status: LeadStatus;
  outcome: LeadOutcome | null;
  updated_at: string;
}

interface DetailLeadRow {
  id: string;
  company_name: string | null;
  phone: string;
  status: LeadStatus;
  outcome: LeadOutcome | null;
  updated_at: string;
}

interface CampaignStats {
  total: number;
  transferred: number;
  voicemail: number;
  noAnswer: number;
  interested: number;
  callback: number;
  discarded: number;
  taxaConversao: number;
}

function computeStats(leads: { status: LeadStatus; outcome: LeadOutcome | null }[]): CampaignStats {
  const total = leads.length;
  const transferred = leads.filter((l) => l.status === "transferred").length;
  const voicemail = leads.filter((l) => l.status === "voicemail").length;
  const noAnswer = leads.filter((l) => l.status === "no_answer" || l.status === "failed").length;
  const interested = leads.filter((l) => l.outcome === "interested").length;
  const callback = leads.filter((l) => l.outcome === "callback").length;
  const discarded = leads.filter((l) => l.outcome === "discarded").length;
  const taxaConversao = total > 0 ? (interested / total) * 100 : 0;
  return { total, transferred, voicemail, noAnswer, interested, callback, discarded, taxaConversao };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBefore(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatFullDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const formatted = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function rankLabel(rank: number): string {
  if (rank === 1) return "🥇 1º lugar do dia";
  if (rank === 2) return "🥈 2º lugar do dia";
  if (rank === 3) return "🥉 3º lugar do dia";
  return `${rank}º lugar do dia`;
}

const COMPARISON_ROWS: { label: string; key: keyof CampaignStats; format?: "percent"; lowerIsBetter?: boolean }[] = [
  { label: "Ligações no dia", key: "total" },
  { label: "Transferidas", key: "transferred" },
  { label: "Caixa postal", key: "voicemail", lowerIsBetter: true },
  { label: "Sem sucesso", key: "noAnswer", lowerIsBetter: true },
  { label: "Interessados", key: "interested" },
  { label: "Retornar depois", key: "callback" },
  { label: "Descartados", key: "discarded", lowerIsBetter: true },
  { label: "Taxa de conversão", key: "taxaConversao", format: "percent" },
];

interface RelatorioDashboardProps {
  userId: string;
  userEmail: string | null;
}

export default function RelatorioDashboard({ userEmail }: RelatorioDashboardProps) {
  const supabase = useMemo(() => createClient(), []);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [dayLeads, setDayLeads] = useState<DayLeadRow[]>([]);
  const [trendLeads, setTrendLeads] = useState<DayLeadRow[]>([]);
  const [detailLeads, setDetailLeads] = useState<DetailLeadRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [operatorId, setOperatorId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [compareCampaignId, setCompareCampaignId] = useState("");

  useEffect(() => {
    supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => data && setCampaigns(data));

    supabase
      .from("operators")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data }) => data && setOperators(data));
  }, [supabase]);

  const loadDayLeads = useCallback(
    async (dateStr: string) => {
      setLoading(true);
      const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
      const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from("leads")
        .select("id, campaign_id, operator_id, status, outcome, updated_at")
        .gte("updated_at", dayStart)
        .lte("updated_at", dayEnd);
      setDayLeads((data as DayLeadRow[]) || []);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    loadDayLeads(date);
  }, [date, loadDayLeads]);

  // Tendência de 7 dias (até o dia selecionado) para este operador nesta campanha.
  useEffect(() => {
    if (!operatorId || !campaignId) {
      setTrendLeads([]);
      return;
    }
    const rangeStart = new Date(`${daysBefore(date, 6)}T00:00:00`).toISOString();
    const rangeEnd = new Date(`${date}T23:59:59.999`).toISOString();
    supabase
      .from("leads")
      .select("id, campaign_id, operator_id, status, outcome, updated_at")
      .eq("campaign_id", campaignId)
      .eq("operator_id", operatorId)
      .gte("updated_at", rangeStart)
      .lte("updated_at", rangeEnd)
      .then(({ data }) => setTrendLeads((data as DayLeadRow[]) || []));
  }, [operatorId, campaignId, date, supabase]);

  // Detalhamento: leads deste operador, nesta campanha, atualizados no dia.
  useEffect(() => {
    if (!operatorId || !campaignId) {
      setDetailLeads([]);
      return;
    }
    const dayStart = new Date(`${date}T00:00:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59.999`).toISOString();
    supabase
      .from("leads")
      .select("id, company_name, phone, status, outcome, updated_at")
      .eq("campaign_id", campaignId)
      .eq("operator_id", operatorId)
      .gte("updated_at", dayStart)
      .lte("updated_at", dayEnd)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setDetailLeads((data as DetailLeadRow[]) || []));
  }, [operatorId, campaignId, date, supabase]);

  // Leads deste operador, nesta campanha, atualizados no dia selecionado.
  const operatorCampaignLeads = useMemo(
    () => dayLeads.filter((l) => l.campaign_id === campaignId && l.operator_id === operatorId),
    [dayLeads, campaignId, operatorId]
  );
  const metrics = useMemo(() => computeStats(operatorCampaignLeads), [operatorCampaignLeads]);

  // Estatísticas do dia por campanha inteira (todos os operadores) — base
  // tanto do gráfico de comparação quanto da comparação direta entre duas.
  const campaignDayStats = useMemo(() => {
    const map = new Map<string, CampaignStats>();
    for (const c of campaigns) {
      map.set(c.id, computeStats(dayLeads.filter((l) => l.campaign_id === c.id)));
    }
    return map;
  }, [campaigns, dayLeads]);

  const comparison = useMemo(
    () =>
      campaigns
        .map((c) => ({ campaignId: c.id, campaignName: c.name, interested: campaignDayStats.get(c.id)?.interested ?? 0 }))
        .sort((a, b) => b.interested - a.interested),
    [campaigns, campaignDayStats]
  );

  const rank = campaignId ? comparison.findIndex((c) => c.campaignId === campaignId) + 1 || null : null;

  // Ranking de operadores dentro da campanha selecionada, no dia.
  const operatorRanking = useMemo(() => {
    if (!campaignId) return [];
    const campaignLeads = dayLeads.filter((l) => l.campaign_id === campaignId);
    return operators
      .map((o) => ({
        operatorId: o.id,
        operatorName: o.name,
        interested: campaignLeads.filter((l) => l.operator_id === o.id && l.outcome === "interested").length,
      }))
      .sort((a, b) => b.interested - a.interested);
  }, [campaignId, dayLeads, operators]);

  const trendSeries = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => daysBefore(date, 6 - i));
    return days.map((d) => ({
      date: d,
      value: trendLeads.filter((l) => l.updated_at.slice(0, 10) === d).length,
    }));
  }, [trendLeads, date]);

  const selectedOperator = operators.find((o) => o.id === operatorId);
  const selectedCampaign = campaigns.find((c) => c.id === campaignId);
  const compareCampaign = campaigns.find((c) => c.id === compareCampaignId);
  const showReport = Boolean(operatorId && campaignId);

  const primaryStats = campaignId ? campaignDayStats.get(campaignId) : undefined;
  const compareStats = compareCampaignId ? campaignDayStats.get(compareCampaignId) : undefined;

  function handleBarClick(id: string) {
    if (id === campaignId) return;
    setCompareCampaignId((prev) => (prev === id ? "" : id));
  }

  return (
    <>
      <Navbar userEmail={userEmail} />

      <main className="mx-auto max-w-6xl px-5 py-12">
        <header className="mb-12 animate-rise border-b border-ink/10 pb-10">
          <p className="eyebrow mb-4">Relatório diário · por operador e campanha</p>
          <h1 className="font-serif text-6xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
            Relatório do
            <br />
            <span className="italic text-accent">Operador</span>
          </h1>
          <p className="mt-5 max-w-xl text-ink-muted">
            Selecione o operador, a campanha e o dia para ver o desempenho e comparar com as outras campanhas.
          </p>
        </header>

        <section className="print:hidden mb-10 grid grid-cols-1 gap-4 rounded-3xl border border-ink/5 bg-paper p-7 shadow-card sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">
              Data {loading && <Loader2 size={12} className="ml-1 inline animate-spin" />}
            </label>
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">Operador</label>
            <select
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            >
              <option value="">Selecione o operador...</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-muted">Campanha</label>
            <select
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                if (e.target.value === compareCampaignId) setCompareCampaignId("");
              }}
              className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            >
              <option value="">Selecione a campanha...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        {!showReport && (
          <div className="rounded-3xl border border-ink/5 bg-paper p-12 text-center shadow-card">
            <p className="text-ink-muted">Selecione o operador e a campanha acima para gerar o relatório do dia.</p>
          </div>
        )}

        {showReport && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <div>
                <p className="eyebrow mb-2">Relatório diário</p>
                <h2 className="font-serif text-3xl font-semibold tracking-tight">
                  {selectedOperator?.name} <span className="text-ink-muted">—</span>{" "}
                  <span className="italic text-accent">{selectedCampaign?.name}</span>
                </h2>
                <p className="mt-1 text-ink-muted">{formatFullDate(date)}</p>
                {rank !== null && campaigns.length > 1 && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                    <Trophy size={14} />
                    {rankLabel(rank)} em interessados, entre {campaigns.length} campanhas
                  </span>
                )}
              </div>
              <button
                onClick={() => window.print()}
                className="print:hidden flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-ember transition hover:-translate-y-0.5 hover:shadow-emberhover"
              >
                <Printer size={16} />
                Exportar / Imprimir
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard icon={<PhoneOutgoing size={18} />} label="Ligações no dia" value={metrics.total} />
              <StatCard icon={<PhoneForwarded size={18} />} label="Transferidas" value={metrics.transferred} tone="text-go" />
              <StatCard icon={<Voicemail size={18} />} label="Caixa postal" value={metrics.voicemail} tone="text-orange-400" />
              <StatCard icon={<PhoneOff size={18} />} label="Sem sucesso" value={metrics.noAnswer} tone="text-ink-muted" />
              <StatCard icon={<Check size={18} />} label="Interessados" value={metrics.interested} tone="text-emerald-400" />
              <StatCard icon={<Square size={18} />} label="Retornar depois" value={metrics.callback} tone="text-amber-400" />
              <StatCard icon={<X size={18} />} label="Descartados" value={metrics.discarded} tone="text-accent" />
              <StatCard icon={<Percent size={18} />} label="Taxa de conversão" value={`${metrics.taxaConversao.toFixed(1)}%`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
                <h2 className="mb-1 flex items-center gap-2 font-serif text-2xl tracking-tight">
                  <PieChart size={20} className="text-accent" />
                  Qualificação do dia
                </h2>
                <p className="mb-6 text-sm text-ink-muted">Como este operador qualificou os leads desta campanha hoje</p>
                <OutcomeDonutChart
                  segments={[
                    { label: "Interessados", value: metrics.interested, color: "#34D399" },
                    { label: "Retornar depois", value: metrics.callback, color: "#FBBF24" },
                    { label: "Descartados", value: metrics.discarded, color: "#EC1C24" },
                  ]}
                />
              </div>

              <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
                <h2 className="mb-1 flex items-center gap-2 font-serif text-2xl tracking-tight">
                  <TrendingUp size={20} className="text-accent" />
                  Tendência · 7 dias
                </h2>
                <p className="mb-6 text-sm text-ink-muted">Ligações trabalhadas por dia, mesmo operador e campanha</p>
                <MiniTrendChart points={trendSeries} />
              </div>
            </div>

            {operatorRanking.length > 1 && (
              <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
                <h2 className="mb-1 flex items-center gap-2 font-serif text-2xl tracking-tight">
                  <Users size={20} className="text-accent" />
                  Ranking de operadores nesta campanha
                </h2>
                <p className="mb-6 text-sm text-ink-muted">Interessados no dia, apenas em {selectedCampaign?.name}</p>
                <CampaignComparisonChart
                  bars={operatorRanking.map((o) => ({
                    id: o.operatorId,
                    label: o.operatorName,
                    value: o.interested,
                    highlight: o.operatorId === operatorId,
                  }))}
                />
              </div>
            )}

            <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl tracking-tight">
                    {campaigns.length > 1 ? <>{selectedCampaign?.name} vs. outras campanhas</> : "Comparação entre campanhas"}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {campaigns.length > 1
                      ? "Interessados no dia · clique numa barra para comparar diretamente com a campanha selecionada"
                      : "Aparece assim que houver mais de uma campanha cadastrada"}
                  </p>
                </div>
                {campaigns.length > 1 && (
                  <div className="print:hidden flex items-center gap-2">
                    <label className="text-xs font-medium text-ink-muted">Comparar com</label>
                    <select
                      value={compareCampaignId}
                      onChange={(e) => setCompareCampaignId(e.target.value)}
                      className="rounded-lg border border-ink/10 bg-ink/5 px-2.5 py-1.5 text-xs outline-none transition focus:border-sky-400"
                    >
                      <option value="">Clique numa barra...</option>
                      {campaigns
                        .filter((c) => c.id !== campaignId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              <CampaignComparisonChart
                bars={comparison.map((c) => ({
                  id: c.campaignId,
                  label: c.campaignName,
                  value: c.interested,
                  highlight: c.campaignId === campaignId,
                  compareActive: c.campaignId === compareCampaignId,
                }))}
                onBarClick={handleBarClick}
              />
            </div>

            {compareCampaignId && compareStats && primaryStats && (
              <div className="rounded-3xl border border-ink/5 bg-paper p-8 shadow-card">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl tracking-tight">Comparação direta</h2>
                    <p className="mt-1 text-sm text-ink-muted">Todas as métricas do dia, campanha a campanha (todos os operadores)</p>
                  </div>
                  <button
                    onClick={() => setCompareCampaignId("")}
                    className="print:hidden flex items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-ink/5 hover:text-ink"
                  >
                    <X size={14} />
                    Remover comparação
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-muted">
                        <th className="py-3 pr-4 font-medium">Métrica</th>
                        <th className="py-3 px-4 font-medium text-accent">{selectedCampaign?.name}</th>
                        <th className="py-3 pl-4 font-medium text-sky-400">{compareCampaign?.name}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_ROWS.map((row) => {
                        const a = primaryStats[row.key];
                        const b = compareStats[row.key];
                        const fmt = (v: number) => (row.format === "percent" ? `${v.toFixed(1)}%` : v.toLocaleString("pt-BR"));
                        const aWins = row.lowerIsBetter ? a < b : a > b;
                        const bWins = row.lowerIsBetter ? b < a : b > a;
                        return (
                          <tr key={row.key} className="border-b border-ink/5 last:border-0">
                            <td className="py-3 pr-4 text-ink-muted">{row.label}</td>
                            <td className={`py-3 px-4 tabular-nums ${aWins ? "font-bold text-accent" : "text-ink"}`}>{fmt(a)}</td>
                            <td className={`py-3 pl-4 tabular-nums ${bWins ? "font-bold text-sky-400" : "text-ink"}`}>{fmt(b)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-ink/5 bg-paper shadow-card">
              <div className="p-8 pb-0">
                <h2 className="font-serif text-2xl tracking-tight">Leads trabalhados no dia</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {selectedOperator?.name} em {selectedCampaign?.name} — últimos {detailLeads.length} atendimentos
                </p>
              </div>
              {detailLeads.length === 0 ? (
                <p className="px-8 py-10 text-center text-sm text-ink-muted">Nenhum lead atendido neste dia ainda.</p>
              ) : (
                <div className="overflow-x-auto p-8 pt-6">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink/5 text-xs uppercase tracking-wide text-ink-muted">
                        <th className="px-2 py-3 font-medium">Empresa</th>
                        <th className="px-2 py-3 font-medium">Telefone</th>
                        <th className="px-2 py-3 font-medium">Status</th>
                        <th className="px-2 py-3 font-medium">Qualificação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-ink/5 last:border-0">
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="shrink-0 text-ink-muted" />
                              <span className="font-medium text-ink">{lead.company_name || "—"}</span>
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-2 text-ink-muted">
                              <Phone size={13} />
                              {lead.phone}
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <StatusBadge status={lead.status} />
                          </td>
                          <td className="px-2 py-3">
                            <OutcomePill outcome={lead.outcome} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "text-ink",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink/5 bg-paper p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardhover">
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-500 ease-out group-hover:scale-x-100" />
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5 ${tone}`}>
          {icon}
        </span>
        <p className={`font-serif text-3xl font-semibold leading-none tabular-nums ${tone}`}>{value}</p>
      </div>
      <p className="mt-4 text-[0.7rem] font-medium uppercase tracking-eyebrow text-ink-muted">{label}</p>
    </div>
  );
}

// Selo de qualificação somente leitura (a edição fica no painel principal via OutcomeButtons).
function OutcomePill({ outcome }: { outcome: LeadOutcome | null }) {
  if (!outcome) {
    return <span className="text-xs text-ink-muted">—</span>;
  }
  const map: Record<LeadOutcome, { label: string; className: string }> = {
    interested: { label: "Interessado", className: "bg-emerald-500/15 text-emerald-300" },
    callback: { label: "Retornar depois", className: "bg-amber-500/15 text-amber-300" },
    discarded: { label: "Descartado", className: "bg-accent/15 text-accent" },
  };
  const info = map[outcome];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.className}`}>
      {info.label}
    </span>
  );
}
