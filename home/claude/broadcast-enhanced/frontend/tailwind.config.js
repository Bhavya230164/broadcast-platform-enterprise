/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class", // class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        brand: {
          50: "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd",
          300: "#7dd3fc", 400: "#38bdf8", 500: "#0ea5e9",
          600: "#0284c7", 700: "#0369a1", 800: "#075985", 900: "#0c4a6e",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
        "slide-in-right": "slideInRight 0.2s ease-out",
        "bounce-soft": "bounceSoft 0.5s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideInRight: { from: { opacity: 0, transform: "translateX(16px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        bounceSoft: { "0%": { transform: "scale(0.95)" }, "60%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};
