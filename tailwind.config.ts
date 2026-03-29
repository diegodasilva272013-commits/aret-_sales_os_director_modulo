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
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        surface: "#0D1117",
        card: "#111827",
        border: "#1F2937",
        primary: {
          DEFAULT: "#6366F1",
          hover: "#4F46E5",
        },
        secondary: {
          DEFAULT: "#8B5CF6",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        muted: "#9CA3AF",
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.4s ease forwards',
        'slide-in': 'slideIn 0.3s ease forwards',
        'pulse-glow': 'pulse-glow 2s infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(99, 102, 241, 0.3)' },
          '50%': { boxShadow: '0 0 25px rgba(99, 102, 241, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
