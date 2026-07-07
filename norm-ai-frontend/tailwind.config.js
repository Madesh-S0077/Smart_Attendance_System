/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FC",
        surface: "#FFFFFF",
        primary: "#5B5FEF",
        "primary-l": "#7B7DFF",
        "text-1": "#1E293B",
        "text-2": "#64748B",
        success: "#22C55E",
        error: "#EF4444",
        holiday: "#FEE2E2",
        border: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        input: "10px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
