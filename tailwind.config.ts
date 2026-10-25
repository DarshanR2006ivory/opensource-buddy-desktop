import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#11182a",
        line: "#263149",
        mint: "#72e0bd",
        muted: "#9aa8bf",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 16px 48px rgba(0, 0, 0, 0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
