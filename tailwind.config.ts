import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FAF8F4",
        ink: {
          DEFAULT: "#1A1A1A",
          dimmed: "#6B6B6B",
        },
        divider: "#E8E3DA",
        accent: {
          DEFAULT: "#4A5A78",
          hover: "#3A4A68",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Newsreader", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        reading: "640px",
      },
      letterSpacing: {
        wordmark: "0.02em",
        label: "0.08em",
      },
      keyframes: {
        reveal: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        reveal: "reveal 450ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        breathe: "breathe 2200ms ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
