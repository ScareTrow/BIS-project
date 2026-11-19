import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

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
          DEFAULT: colors.blue[600],
          dark: colors.blue[700],
          light: colors.blue[50],
        },
        success: {
          DEFAULT: colors.green[700],
          dark: colors.green[800],
          light: colors.green[50],
        },
        danger: {
          DEFAULT: colors.red[600],
          dark: colors.red[700],
          light: colors.red[50],
        },
        warning: {
          DEFAULT: colors.amber[700],
          dark: colors.amber[800],
          light: colors.amber[50],
        },
        info: {
          DEFAULT: colors.blue[700],
          dark: colors.blue[800],
          light: colors.blue[50],
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

