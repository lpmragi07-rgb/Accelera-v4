import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Fontes carregadas via next/font no layout.tsx (variáveis CSS)
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        // Paleta "V4 Company" (dark): preto profundo + vermelho + verde de ação
        ink: {
          DEFAULT: "#F5F5F6", // texto claro (sobre fundo escuro)
          muted: "#9A9AA3",
        },
        accent: {
          DEFAULT: "#EC1C24", // vermelho V4 (marca / parar)
          soft: "#2A0E10", // vermelho escuro translúcido (superfícies)
        },
        go: {
          DEFAULT: "#2FB457", // verde V4 (ação / iniciar)
          soft: "#0F2A1A",
        },
        canvas: "#09090B", // preto (fundo da página)
        paper: "#161618", // superfície dos cartões (cinza escuro)
      },
      letterSpacing: {
        eyebrow: "0.22em",
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.03) inset, 0 18px 40px -20px rgba(0,0,0,0.8)",
        cardhover: "0 1px 0 rgba(255,255,255,0.05) inset, 0 28px 60px -24px rgba(0,0,0,0.9)",
        ember: "0 10px 30px -10px rgba(236,28,36,0.6)",
        emberhover: "0 16px 38px -12px rgba(236,28,36,0.75)",
        go: "0 10px 30px -10px rgba(47,180,87,0.55)",
        gohover: "0 16px 38px -12px rgba(47,180,87,0.7)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
