/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
  darkMode: ["class"],
  plugins: [],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      animation: {
        "fade-in": "fade-in 0.3s ease-out forwards",
        "spring-scale": "spring-scale 0.2s ease-in-out forwards",
        "star-spin": "star-spin 3s ease-in-out infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.1rem)",
        sm: "calc(var(--radius) - 0.4rem)",
      },
      boxShadow: {
        chat: "0 10px 40px rgba(0,0,0,0.04)",
        expanded: "0 8px 16px rgba(0,0,0,0.15)",
        subtle: "0 0 6px rgba(0,0,0,0.06)",
        tab: "0 0 5px rgba(0,0,0,0.08)",
      },
      colors: {
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        background: "rgb(var(--background) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        ring: "rgb(var(--ring) / <alpha-value>)",
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
      },
      fontSize: {
        "2xs": ["0.625rem", "0.75rem"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "spring-scale": {
          "0%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
        "star-spin": {
          "0%, 50%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
          "60%": { transform: "rotate(-20deg)" },
          "65%": { transform: "rotate(-15deg)" },
          "67%": { transform: "rotate(-20deg)" },
        },
      },
      spacing: {
        4.5: "1.125rem",
      },
    },
  },
};
