import type { LeadStatus } from "@/types/database";

const STATUS_MAP: Record<LeadStatus, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-ink/10 text-ink-muted" },
  queued: { label: "Na fila", className: "bg-sky-500/15 text-sky-300" },
  calling: { label: "Discando", className: "bg-amber-500/15 text-amber-300" },
  human_answered: { label: "Humano atendeu", className: "bg-indigo-500/15 text-indigo-300" },
  transferred: { label: "Transferido", className: "bg-emerald-500/15 text-emerald-300" },
  voicemail: { label: "Caixa postal", className: "bg-orange-500/15 text-orange-300" },
  no_answer: { label: "Não atendeu", className: "bg-zinc-500/15 text-zinc-300" },
  failed: { label: "Falha", className: "bg-red-500/15 text-red-300" },
  completed: { label: "Concluído", className: "bg-emerald-500/15 text-emerald-300" },
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const info = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.className}`}
    >
      {info.label}
    </span>
  );
}
