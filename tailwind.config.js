/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#06070a",
          900: "#090b10",
          850: "#0c0f15",
          800: "#10141c",
          750: "#141924",
          700: "#1a2030",
          600: "#232b3d",
          500: "#2d3750",
        },
        line: {
          DEFAULT: "#1b2130",
          soft: "#151a26",
          bright: "#283147",
        },
        haze: {
          100: "#eef2fa",
          200: "#d7deec",
          300: "#b3bfd4",
          400: "#8b98af",
          500: "#6c7a92",
          600: "#4e5a70",
          700: "#394253",
        },
        mint: {
          300: "#8ff5d0",
          400: "#5ce8b4",
          500: "#2fd39b",
          600: "#17a97a",
        },
        iris: {
          300: "#b0b8ff",
          400: "#8b95ff",
          500: "#6d78f5",
        },
        ember: {
          400: "#ff8a75",
          500: "#ff6b7a",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(92,232,180,0.16), 0 0 24px -6px rgba(92,232,180,0.35)",
        panel: "0 24px 70px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px)",
        "accent-sheen": "linear-gradient(135deg, rgba(92,232,180,0.18), rgba(139,149,255,0.10))",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "0.35", transform: "scale(0.94)" },
          "50%": { opacity: "1", transform: "scale(1.06)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-6px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
        "fade-up": "fade-up 220ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "slide-in": "slide-in 200ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        shimmer: "shimmer 2.4s linear infinite",
        orbit: "orbit 6s linear infinite",
      },
    },
  },
  plugins: [],
};
