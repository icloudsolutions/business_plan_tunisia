import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f4f6f9",
          100: "#e8ecf2",
          200: "#c5d0de",
          500: "#3d5a7a",
          600: "#2a4260",
          700: "#1a3352",
          800: "#0F2744",
          900: "#0a1a2e",
        },
        gold: {
          50: "#faf6eb",
          100: "#f3ead0",
          300: "#d4b96a",
          400: "#C9A84C",
          500: "#b8923f",
          600: "#9a7a34",
        },
        brand: {
          500: "#0F2744",
          600: "#0a1a2e",
          700: "#0F2744",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "var(--font-sans-ar)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(15, 39, 68, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
