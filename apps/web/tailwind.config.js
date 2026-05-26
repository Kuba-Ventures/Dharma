/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy — removed in commit 2.
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        // Brand purple
        brand: {
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          400: "var(--brand-400)",
          600: "var(--brand-600)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
        },
        // Label palette (use only on user data — never on chrome)
        label: {
          1: "var(--label-1)",
          2: "var(--label-2)",
          3: "var(--label-3)",
          4: "var(--label-4)",
          5: "var(--label-5)",
          6: "var(--label-6)",
          7: "var(--label-7)",
          8: "var(--label-8)",
          9: "var(--label-9)",
          10: "var(--label-10)",
        },
      },
      borderRadius: {
        card: "var(--radius-card)",
        hero: "var(--radius-hero)",
        btn: "var(--radius-btn)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Plus Jakarta Sans", "sans-serif"],
        sans: ["Arial", "ui-sans-serif", "sans-serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
