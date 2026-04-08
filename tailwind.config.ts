import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0D1B2A",
          50: "#1a2f42",
          100: "#162636",
          200: "#0D1B2A",
        },
        gold: {
          DEFAULT: "#C9A84C",
          light: "#D4B86A",
          dark: "#A8882E",
        },
        cream: "#F8F7F4",
        streams: {
          bg: "#F8F7F4",
          "dark-bg": "#0D1B2A",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        heading: ["var(--font-playfair)", "Playfair Display", "serif"],
      },
      borderRadius: {
        card: "16px",
        xl: "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 2px 16px 0 rgba(13, 27, 42, 0.08)",
        "card-hover": "0 4px 24px 0 rgba(13, 27, 42, 0.14)",
        gold: "0 2px 12px 0 rgba(201, 168, 76, 0.25)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-in": "slideIn 0.35s ease-out",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseGold: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
