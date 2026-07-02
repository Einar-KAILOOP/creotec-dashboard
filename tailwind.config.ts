import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-outfit)", "sans-serif"],
      },
      colors: {
        creotec: {
          primary: "#0F766E",   // teal-700 — color corporativo principal
          accent: "#14B8A6",    // teal-500
          dark: "#0B3B37",
        },
      },
    },
  },
  plugins: [],
};

export default config;
