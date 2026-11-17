import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
          light: "#f87171",
        },
        success: {
          DEFAULT: "#10b981",
          dark: "#059669",
          light: "#34d399",
        },
        danger: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
          light: "#f87171",
        },
        warning: {
          DEFAULT: "#f59e0b",
          dark: "#d97706",
          light: "#fbbf24",
        },
        info: {
          DEFAULT: "#3b82f6",
          dark: "#2563eb",
          light: "#60a5fa",
        },
        emergency: {
          DEFAULT: "#dc2626",
          dark: "#991b1b",
          light: "#fca5a5",
        },
      },
    },
  },
  plugins: [],
};
export default config;

