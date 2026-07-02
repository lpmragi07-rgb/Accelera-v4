"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, Loader2, Radio, Headphones, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Cliente criado dentro do handler para evitar instanciação no SSG
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Conta criada! Verifique seu e-mail para confirmar (se exigido) e faça login.");
        setMode("login");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }
    setLoading(false);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      {/* Painel de marca — preto V4 com glow vermelho */}
      <aside className="relative hidden overflow-hidden border-r border-ink/10 bg-paper px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        {/* Atmosfera do painel: glow vermelho V4 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(40rem 40rem at 85% 0%, rgba(236,28,36,0.30), transparent 58%), radial-gradient(34rem 34rem at -10% 110%, rgba(236,28,36,0.14), transparent 60%)",
          }}
        />
        {/* Hairlines verticais decorativas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #fff 0, #fff 1px, transparent 1px, transparent 6.5rem)",
          }}
        />

        <div className="relative animate-rise">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-ember">
            <PhoneCall size={22} />
          </span>
        </div>

        <div className="relative max-w-md animate-rise">
          <p className="eyebrow">Auto Dialer · API4Com</p>
          <h1 className="mt-5 font-serif text-[3.6rem] font-semibold leading-[0.98] tracking-tight">
            Ligações que<br />
            <span className="italic text-accent">se conectam</span><br />
            sozinhas.
          </h1>
          <p className="mt-6 max-w-sm text-ink-muted">
            Suba sua lista, dispare em lote e transfira automaticamente quem
            atende para o operador livre. Você só conversa com gente de verdade.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-ink">
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5">
                <Radio size={16} className="text-accent" />
              </span>
              Discagem progressiva, um cliente por operador
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5">
                <Headphones size={16} className="text-accent" />
              </span>
              Transferência instantânea para quem está livre
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/10 bg-ink/5">
                <ListChecks size={16} className="text-accent" />
              </span>
              Qualificação: interessado, retornar ou descartado
            </li>
          </ul>
        </div>

        <p className="relative text-xs uppercase tracking-eyebrow text-ink-muted animate-rise">
          V4 Company · Accelera
        </p>
      </aside>

      {/* Coluna do formulário */}
      <section className="relative flex items-center justify-center px-5 py-12">
        <div className="brand-rule absolute inset-x-0 top-0 h-1 lg:hidden" />
        <div className="w-full max-w-md animate-rise">
          {/* Cabeçalho compacto (visível principalmente no mobile, sem o painel) */}
          <div className="mb-8 lg:hidden">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-ember">
              <PhoneCall size={22} />
            </span>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">
              Accelera
            </h1>
            <p className="mt-1 text-ink-muted">
              Discagem automática com detecção de caixa postal.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-ink/10 bg-paper p-8 shadow-cardhover"
          >
            <p className="eyebrow mb-2">
              {mode === "login" ? "Bem-vindo de volta" : "Vamos começar"}
            </p>
            <h2 className="mb-7 font-serif text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>

            <label className="mb-1.5 block text-sm font-medium text-ink-muted">
              E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-accent focus:ring-4 focus:ring-accent/10"
              placeholder="voce@empresa.com"
            />

            <label className="mb-1.5 block text-sm font-medium text-ink-muted">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mb-6 w-full rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-accent focus:ring-4 focus:ring-accent/10"
              placeholder="••••••••"
            />

            {error && (
              <p className="mb-4 rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
            {message && (
              <p className="mb-4 rounded-lg border border-go/20 bg-go/10 px-3 py-2 text-sm text-emerald-200">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-medium text-zinc-900 shadow-card transition hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-cardhover disabled:translate-y-0 disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === "login" ? "signup" : "login"));
                setError(null);
                setMessage(null);
              }}
              className="mt-4 w-full text-center text-sm text-ink-muted transition hover:text-ink"
            >
              {mode === "login"
                ? "Não tem conta? Criar agora"
                : "Já tem conta? Entrar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
