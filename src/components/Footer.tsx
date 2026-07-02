"use client";

import Image from "next/image";
import { ChevronUp } from "lucide-react";

// Rodapé no estilo V4: marca à esquerda, "Retornar ao topo" à direita,
// hairline vermelha de separação e a linha de copyright centralizada.
export default function Footer() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <footer className="relative mt-20 border-t border-ink/10 bg-canvas">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Marca V4 */}
          <div className="flex items-center gap-3">
            <Image
              src="/v4logo.jpg"
              alt="V4 Company"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-cover"
              priority
            />
            <span className="text-sm font-semibold uppercase tracking-eyebrow text-ink">
              Almeida &amp; Co.
            </span>
          </div>

          {/* Retornar ao topo */}
          <button
            onClick={scrollToTop}
            className="group flex items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-accent"
          >
            <ChevronUp
              size={18}
              className="text-accent transition-transform group-hover:-translate-y-0.5"
            />
            Retornar ao topo
          </button>
        </div>

        {/* Hairline vermelha de separação */}
        <div className="brand-rule mt-6 h-px w-full opacity-80" />

        {/* Copyright centralizado */}
        <p className="mt-6 text-center text-xs text-ink-muted">
          2026 © V4 Almeida e Co. Todos os direitos reservados.{" "}
          <a href="#" className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            Políticas de privacidade
          </a>
        </p>
      </div>
    </footer>
  );
}
