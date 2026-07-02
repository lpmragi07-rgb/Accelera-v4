"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, FileText } from "lucide-react";

interface UploadCardProps {
  onUploaded: (campaignId: string) => void;
}

export default function UploadCard({ onUploaded }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setFeedback({ type: "err", text: "Selecione um arquivo CSV." });
      return;
    }
    setLoading(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("campaignName", campaignName);

    const res = await fetch("/api/leads/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      setFeedback({ type: "err", text: data.error || "Falha no upload." });
    } else {
      setFeedback({ type: "ok", text: `${data.inserted} leads importados com sucesso.` });
      setFile(null);
      setCampaignName("");
      if (inputRef.current) inputRef.current.value = "";
      onUploaded(data.campaign.id);
    }
    setLoading(false);
  }

  return (
    <section className="rounded-3xl border border-ink/10 bg-paper p-7 shadow-card transition-shadow hover:shadow-cardhover">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
          <UploadCloud size={18} />
        </span>
        <h2 className="font-serif text-2xl tracking-tight">Importar leads (CSV)</h2>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col gap-4">
        <input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="Nome da campanha (opcional)"
          className="w-full rounded-xl border border-ink/10 bg-ink/5 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink-muted focus:border-accent focus:ring-4 focus:ring-accent/10"
        />

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-ink/5 px-4 py-9 text-center transition-colors hover:border-accent hover:bg-accent/10">
          <FileText size={28} className="text-ink-muted" />
          <span className="text-sm font-medium">
            {file ? file.name : "Clique para selecionar o CSV"}
          </span>
          <span className="text-xs text-ink-muted">
            Cabeçalhos aceitos: empresa/nome e telefone/phone
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {feedback && (
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              feedback.type === "ok"
                ? "border-go/20 bg-go/10 text-emerald-200"
                : "border-accent/20 bg-accent/10 text-red-200"
            }`}
          >
            {feedback.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-ink py-3 font-medium text-canvas transition hover:bg-ink/90 disabled:opacity-60"
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          Importar leads
        </button>
      </form>
    </section>
  );
}
