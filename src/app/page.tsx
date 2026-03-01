'use client'

// 1. React imports
import { useState } from 'react'

// 2. Next.js imports
import Link from 'next/link'

// 3. Third-party library imports
import { motion } from 'framer-motion'
import {
  FileText,
  ListChecks,
  AlertCircle,
  Code2,
  BookOpen,
  Smartphone,
  ArrowRight,
  Zap,
  X,
} from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'

// 5. Internal imports — utils
import { cn } from '@/lib/utils'

// 6. Animation variants
const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease: 'easeOut' },
  }),
}

// 7. Feature card data
interface FeatureCard {
  icon: React.ElementType
  title: string
  description: string
}

const FEATURES: FeatureCard[] = [
  {
    icon: FileText,
    title: 'Global Context Document',
    description:
      'A single source of truth for every project. Generated, stored, and auto-updated so nothing is ever lost or guessed.',
  },
  {
    icon: ListChecks,
    title: 'Sequential File Generation',
    description:
      'Interactive checklist tracks every file. Per-file stored prompts, status badges, and dependency tracking built in.',
  },
  {
    icon: AlertCircle,
    title: 'Error Resolution Workflow',
    description:
      'Two-step prompt generation: first identify which files Claude needs, then get surgical line-by-line replacements.',
  },
  {
    icon: Code2,
    title: 'Monaco Browser Editor',
    description:
      'The same engine as VS Code, running entirely in your browser. Full syntax highlighting for every language.',
  },
  {
    icon: BookOpen,
    title: 'Prompt Library',
    description:
      'Community-wide searchable library of prompts for Claude, ChatGPT, Midjourney, and every major AI tool.',
  },
  {
    icon: Smartphone,
    title: 'Full Mobile Support',
    description:
      "The entire workflow runs on a smartphone. No laptop required until you're ready to test locally.",
  },
]

// 8. Trust badges
const TRUST_BADGES = [
  '5+ Production Apps Built',
  'Works on Mobile',
  'Zero Hardcoded Limits',
]

// 9. Demo video modal
function DemoModal({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="relative w-full max-w-3xl mx-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)] transition-colors"
          aria-label="Close demo"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-light)] border border-[var(--accent-border)]">
            <Zap className="h-8 w-8 text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)]">Demo Coming Soon</h3>
          <p className="text-center text-[var(--text-secondary)] max-w-sm">
            A full walkthrough video is being produced. In the meantime, create a free account
            and explore DevForge yourself — it takes 60 seconds.
          </p>
          <Link href="/register">
            <Button className="mt-2 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

// 10. Component definition
export default function LandingPage(): JSX.Element {
  const [showDemo, setShowDemo] = useState(false)

  return (
    <>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {/* ── Navigation ─────────────────────────────────────────────── */}
        <nav className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-[var(--text-primary)]">DevForge</span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-[var(--text-secondary)]">
            <button
              type="button"
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              Features
            </button>
            <Link href="/library" className="hover:text-[var(--text-primary)] transition-colors">
              Prompt Library
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-quaternary)]"
              >
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] shadow-[var(--shadow-glow)] active:scale-95 transition-all duration-150">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-20">
          {/* Animated grid background */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(var(--accent-primary) 1px, transparent 1px), linear-gradient(90deg, var(--accent-primary) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
            aria-hidden="true"
          />

          {/* Glow orb */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06]"
            style={{
              background:
                'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 flex max-w-4xl flex-col items-center text-center gap-6">
            {/* Badge */}
            <motion.div
              custom={0}
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-light)] px-4 py-1.5 text-sm font-medium text-[var(--accent-primary)]">
                <Zap className="h-3.5 w-3.5" />
                Built on a proven methodology — 5+ production apps deployed
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
              className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-[var(--text-primary)]"
            >
              Build AI Projects{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-purple-400">
                Without Losing Context
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              custom={2}
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
              className="max-w-2xl text-lg md:text-xl text-[var(--text-secondary)] leading-relaxed"
            >
              The complete workflow platform for AI-assisted development — from idea to deployed
              app, every step organized. Never lose a prompt, guess a dependency, or redo a file
              from scratch again.
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={3}
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row items-center gap-4 mt-2"
            >
              <Link href="/register">
                <Button
                  className={cn(
                    'h-12 px-8 text-base font-semibold gap-2',
                    'bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 text-white',
                    'shadow-[0_0_24px_rgba(99,102,241,0.35)]',
                    'hover:shadow-[0_0_32px_rgba(99,102,241,0.5)]',
                    'active:scale-95 transition-all duration-150'
                  )}
                >
                  Start Building Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDemo(true)}
                className={cn(
                  'h-12 px-8 text-base font-semibold gap-2',
                  'border-[var(--border-emphasis)] text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] hover:border-[var(--accent-border)]',
                  'hover:bg-[var(--accent-light)] transition-all duration-150'
                )}
              >
                Watch How It Works
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              custom={4}
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap items-center justify-center gap-3 mt-2"
            >
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-complete)]" />
                  {badge}
                </span>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Features Grid ───────────────────────────────────────────── */}
        <section id="features" className="px-6 py-24 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
              Everything in one place
            </h2>
            <p className="mt-4 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Every tool you need for AI-assisted development, systematized and automated so you
              can focus on building rather than managing.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={feature.title}
                  custom={i}
                  variants={FADE_UP}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className={cn(
                    'group flex flex-col gap-4 rounded-xl border p-6',
                    'border-[var(--border-subtle)] bg-[var(--bg-tertiary)]',
                    'hover:border-[var(--accent-border)] hover:-translate-y-0.5',
                    'hover:shadow-[var(--shadow-md)] transition-all duration-200',
                    'cursor-default'
                  )}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-light)] border border-[var(--accent-border)] group-hover:shadow-[var(--shadow-glow)] transition-shadow duration-200">
                    <Icon className="h-5 w-5 text-[var(--accent-primary)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                    <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* ── CTA Banner ──────────────────────────────────────────────── */}
        <section className="px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className={cn(
              'relative overflow-hidden rounded-2xl max-w-4xl mx-auto p-12 text-center',
              'bg-gradient-to-br from-[var(--accent-primary)]/20 via-purple-500/10 to-transparent',
              'border border-[var(--accent-border)]'
            )}
          >
            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 50%, var(--accent-primary) 0%, transparent 60%)',
              }}
              aria-hidden="true"
            />
            <div className="relative z-10 flex flex-col items-center gap-6">
              <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
                Ready to build without chaos?
              </h2>
              <p className="text-lg text-[var(--text-secondary)] max-w-xl">
                Join developers who have stopped losing prompts, hunting through old conversations,
                and manually managing context documents.
              </p>
              <Link href="/register">
                <Button
                  className={cn(
                    'h-12 px-10 text-base font-semibold gap-2',
                    'bg-[var(--accent-primary)] text-white',
                    'hover:bg-[var(--accent-hover)]',
                    'shadow-[var(--shadow-glow)] hover:shadow-[0_0_32px_rgba(99,102,241,0.5)]',
                    'active:scale-95 transition-all duration-150'
                  )}
                >
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="border-t border-[var(--border-subtle)] px-6 py-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-primary)]">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">DevForge</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-[var(--text-tertiary)]">
              <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors">
                Privacy
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--text-secondary)] transition-colors"
              >
                GitHub
              </a>
              <Link href="/contact" className="hover:text-[var(--text-secondary)] transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </div>

      {/* Demo modal */}
      {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
    </>
  )
}