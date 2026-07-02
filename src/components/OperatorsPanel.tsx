"use client";

import { useState } from "react";
import { UserPlus, Trash2, Loader2, Headphones, PhoneCall, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Lead, Operator, OperatorStatus } from "@/types/database";

interface OperatorsPanelProps {
  userId: string;
  operators: Operator[];
  activeCalls: Record<string, Lead>; // operatorId -> lead em ligação
  onChange: () => void;
}

const STATUS_OPTIONS: { value: OperatorStatus; label: string; dot: string }[] = [
  { value: "available", label: "Disponível", dot: "bg-emerald-500" },
  { value: "busy", label: "Ocupado (pausado)", dot: "bg-amber-500" },
  { value: "offline", label: "Offline", dot: "bg-stone-400" },
];

export default function OperatorsPanel({
  userId,
  operators,
  activeCalls,
  onChange,
}: OperatorsPanelProps) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [extension, setExtension] = useState("");
  const [saving, setSaving] = useState(false);

  async function addOperator(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !extension.trim()) return;
    setSaving(true);
    await supabase.from("operators").insert({
      user_id: userId,
      name: name.trim(),
      extension: extension.trim(),
      status: "available",
    });
    setName("");
    setExtension("");
    setSaving(false);
    onChange();
  }

  async function updateStatus(id: string, status: OperatorStatus) {
    await supabase.from("operators").update({ status }).eq("id", id);
    onChange();
  }

  async function removeOperator(id: string) {
    await supabase.from("operators").delete().eq("id", id);
    onChange();
  }

  return (
    <section
      id="operadores"
      className="group/card rounded-3xl border border-ink/5 bg-paper p-7 shadow-card transition-shadow hover:shadow-cardhover"
    >
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <Headphones size={18} />
        </span>
        <h2 className="font-serif text-2xl tracking-tight">Operadores</h2>
      </div>

      <form onSubmit={addOperator} className="mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do operador"
            className="w-full min-w-0 rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
          <input
            value={extension}
            onChange={(e) => setExtension(e.target.value)}
            placeholder="Ramal API4Com (ex.: 1000)"
            className="w-full min-w-0 rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent/10"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition hover:bg-ink/90 disabled:opacity-60 sm:w-auto sm:self-end"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          Adicionar
        </button>
      </form>

      {operators.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nenhum operador cadastrado. Adicione ao menos um, marque como
          “Disponível” e deixe o ramal logado no webphone da API4Com.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {operators.map((op) => {
            const call = activeCalls[op.id];
            const isLiveCall =
              call &&
              (call.status === "calling" || call.status === "human_answered");
            const needsQualification =
              call &&
              !isLiveCall &&
              !call.outcome &&
              ["no_answer", "transferred", "voicemail", "failed"].includes(
                call.status
              );
            const showClient = Boolean(call);
            const highlight = isLiveCall || needsQualification;

            return (
              <li
                key={op.id}
                className={`rounded-2xl border px-4 py-3.5 transition ${
                  highlight
                    ? "border-accent/40 bg-accent/10"
                    : "border-ink/10 bg-ink/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{op.name}</p>
                    <p className="truncate text-sm text-ink-muted">
                      Ramal {op.extension ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLiveCall && (
                      <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                        </span>
                        Em ligação
                      </span>
                    )}
                    {needsQualification && (
                      <span className="rounded-full bg-accent/20 px-2.5 py-1 text-xs font-medium text-accent">
                        Qualificar
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          STATUS_OPTIONS.find((s) => s.value === op.status)?.dot
                        }`}
                      />
                      <select
                        value={op.status}
                        onChange={(e) =>
                          updateStatus(op.id, e.target.value as OperatorStatus)
                        }
                        className="rounded-lg border border-ink/10 bg-ink/5 px-2 py-1 text-sm outline-none"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => removeOperator(op.id)}
                      className="text-ink-muted transition-colors hover:text-red-600"
                      aria-label="Remover operador"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Cliente em ligação ou aguardando qualificação do operador */}
                {showClient && call && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2 text-sm">
                    <PhoneCall size={15} className="shrink-0 text-accent" />
                    <span className="text-ink-muted">
                      {isLiveCall ? "Ligando para" : "Qualificar cliente"}
                    </span>
                    <Building2 size={15} className="shrink-0 text-ink-muted" />
                    <span className="truncate font-medium text-ink">
                      {call.company_name || call.phone}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
