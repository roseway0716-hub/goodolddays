import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        ink: "#2B2118",
        rust: "#8A5A44",
        line: "#D8CCBB",
      },
      boxShadow: {
        folio: "0 24px 60px rgba(73, 50, 34, 0.14)",
      },
      backgroundImage: {
        fiber:
          "radial-gradient(circle at 1px 1px, rgba(120, 92, 64, 0.08) 1px, transparent 0)",
      },
      fontFamily: {
        body: ["var(--font-sans)"],
        display: ["var(--font-serif)"],
      },
    },
  },
  plugins: [],
};

export default config;
