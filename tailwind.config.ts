import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        subtle: "rgb(var(--subtle) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: { sans: ["IBM Plex Sans Arabic", "Inter", "system-ui", "sans-serif"] },
      borderRadius: { xl: "14px", "2xl": "18px" },
      boxShadow: { card: "0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px -4px rgb(0 0 0 / 0.06)", pop: "0 12px 40px -8px rgb(0 0 0 / 0.25)" },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        in: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { in: "in .25s ease-out both" },
    },
  },
  plugins: [],
} satisfies Config;
