import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        'bg-primary':     'var(--bg-primary)',
        'bg-secondary':   'var(--bg-secondary)',
        'bg-tertiary':    'var(--bg-tertiary)',
        'bg-quaternary':  'var(--bg-quaternary)',
        'bg-input':       'var(--bg-input)',

        // Borders
        'border-subtle':   'var(--border-subtle)',
        'border-default':  'var(--border-default)',
        'border-emphasis': 'var(--border-emphasis)',

        // Text
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary':  'var(--text-tertiary)',
        'text-inverse':   'var(--text-inverse)',

        // Accent
        'accent-primary': 'var(--accent-primary)',
        'accent-hover':   'var(--accent-hover)',
        'accent-light':   'var(--accent-light)',
        'accent-border':  'var(--accent-border)',

        // Status
        'status-complete':         'var(--status-complete)',
        'status-complete-bg':      'var(--status-complete-bg)',
        'status-in-progress':      'var(--status-in-progress)',
        'status-in-progress-bg':   'var(--status-in-progress-bg)',
        'status-error':            'var(--status-error)',
        'status-error-bg':         'var(--status-error-bg)',
        'status-empty':            'var(--status-empty)',
        'status-empty-bg':         'var(--status-empty-bg)',
      },

      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      fontSize: {
        // Section 7.2 typography scale
        xs:   ['11px', { lineHeight: '16px' }],
        sm:   ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        md:   ['15px', { lineHeight: '24px' }],
        lg:   ['16px', { lineHeight: '26px' }],
        xl:   ['18px', { lineHeight: '28px' }],
        '2xl': ['20px', { lineHeight: '30px' }],
        '3xl': ['24px', { lineHeight: '34px' }],
        '4xl': ['32px', { lineHeight: '42px' }],
      },

      spacing: {
        '1':  'var(--space-1)',
        '2':  'var(--space-2)',
        '3':  'var(--space-3)',
        '4':  'var(--space-4)',
        '5':  'var(--space-5)',
        '6':  'var(--space-6)',
        '8':  'var(--space-8)',
        '10': 'var(--space-10)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
      },

      borderRadius: {
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      boxShadow: {
        sm:   'var(--shadow-sm)',
        md:   'var(--shadow-md)',
        lg:   'var(--shadow-lg)',
        glow: 'var(--shadow-glow)',
      },

      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },

      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },

      animation: {
        'fade-in':       'fade-in 200ms ease forwards',
        'slide-up':      'slide-up 200ms ease forwards',
        'slide-in-right':'slide-in-right 300ms cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-subtle':  'pulse-subtle 2s ease-in-out infinite',
        'accordion-down':'accordion-down 200ms ease-out',
        'accordion-up':  'accordion-up 200ms ease-out',
      },

      screens: {
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}

export default config