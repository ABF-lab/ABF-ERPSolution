/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: "#FFD23F",
          "yellow-soft": "#FFE680",
          "yellow-deep": "#F5B800",
          red: "#EF4136",
          "red-deep": "#C8261B",
          ink: "#1A1A1A",
          cream: "#FFF8E7",
          paper: "#FFFDF5",
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', "Impact", "system-ui", "sans-serif"],
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(0,0,0,0.18)",
        "card-lg": "0 20px 50px -20px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      maxWidth: {
        prose: "68ch",
      },
    },
  },
  plugins: [],
};
