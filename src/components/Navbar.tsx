"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  userEmail?: string | null;
}

const NAV_LINKS = [
  { label: "Painel", href: "#painel" },
  { label: "Operadores", href: "#operadores" },
  { label: "Ligações", href: "#ligacoes" },
];

export default function Navbar({ userEmail }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    // Navbar SEMPRE sticky no topo
    <header className="sticky top-0 z-50 border-b border-ink/5 bg-canvas/70 backdrop-blur-xl">
      {/* Faixa fina de acento da marca no topo absoluto */}
      <div className="brand-rule h-0.5 w-full" />
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#painel" className="group flex items-center gap-2.5">
          <Image
            src="/v4logo.jpg"
            alt="V4 Company"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-xl object-cover shadow-ember transition-transform duration-300 group-hover:-rotate-6"
          />
          <span className="font-serif text-xl font-semibold tracking-tight">
            Accel<span className="text-accent">era</span>
          </span>
        </a>

        {/* Links desktop */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {userEmail && (
            <span className="text-sm text-ink-muted">{userEmail}</span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-ink/10"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>

        {/* Botão mobile */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-ink/10 md:hidden"
          aria-label="Abrir menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Painel mobile: desce do topo, ocupa metade da tela (h-[50vh]), não cobre tudo */}
      {open && (
        <div className="md:hidden">
          <div
            className="absolute inset-x-0 top-16 z-40 flex h-[50vh] flex-col justify-between border-b border-ink/10 bg-canvas px-5 py-6 shadow-card"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 font-serif text-2xl text-ink transition-colors hover:bg-ink/5"
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-ink/10 pt-4">
              {userEmail && (
                <span className="truncate text-sm text-ink-muted">{userEmail}</span>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
              >
                <LogOut size={15} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
