/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shine: {
          '100%': { transform: 'translateX(100%)' },
        },
        'step-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.18)' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'shimmer-mini': {
          '0%, 15%': { left: '-25%' },
          '65%, 100%': { left: '125%' },
        },
        'tab-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-28px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'tab-in-right': {
          '0%': { opacity: '0', transform: 'translateX(28px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'ken-burns': {
          '0%, 100%': { transform: 'scale(1) translate(0, 0)' },
          '50%': { transform: 'scale(1.08) translate(-1%, -1%)' },
        },
        // Storage / AI usage meters (StorageMeter.tsx, MonthlyAiUsageMeter.tsx): a brief
        // scale-pop on the meter's icon the instant its underlying value ticks up, so the change
        // reads as "something just happened" instead of the number silently changing.
        'meter-pulse': {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(1.35)' },
          '55%': { transform: 'scale(0.94)' },
          '100%': { transform: 'scale(1)' },
        },
        // MonthlyAiUsageMeter's "RPM gauge" needle: sweeps up toward the red line, hesitates /
        // stutters right at it (small back-and-forth wobble), then eases back down to idle -
        // literal car-tachometer behavior, looped while an AI generation is in flight.
        'rpm-needle': {
          '0%': { transform: 'rotate(-55deg)' },
          '16%': { transform: 'rotate(38deg)' },
          '22%': { transform: 'rotate(30deg)' },
          '28%': { transform: 'rotate(41deg)' },
          '34%': { transform: 'rotate(32deg)' },
          '40%': { transform: 'rotate(38deg)' },
          '58%': { transform: 'rotate(-15deg)' },
          '78%': { transform: 'rotate(-55deg)' },
          '100%': { transform: 'rotate(-55deg)' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        shine: 'shine 1s ease-in-out infinite',
        'step-in': 'step-in 0.4s ease-out',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'shimmer-sweep': 'shimmer-sweep 2.5s ease-in-out infinite',
        'shimmer-mini': 'shimmer-mini 3.5s ease-in-out infinite',
        'tab-in-left': 'tab-in-left 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'tab-in-right': 'tab-in-right 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        'ken-burns': 'ken-burns 6s ease-in-out infinite',
        'meter-pulse': 'meter-pulse 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1',
        'rpm-needle': 'rpm-needle 2.8s cubic-bezier(0.45, 0, 0.55, 1) infinite',
      },
    },
  },
  plugins: [],
}