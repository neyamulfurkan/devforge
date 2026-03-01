'use client'

// 1. React imports
import { useState } from 'react'

// 2. Next.js imports
import Link from 'next/link'

// 3. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck, ArrowLeft, Send } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 5. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — validation, utils
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/validations/auth'
import { cn } from '@/lib/utils'

// ─── Success state ────────────────────────────────────────────────────────────

interface SuccessViewProps {
  email: string
}

function SuccessView({ email }: SuccessViewProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      {/* Icon */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: 'var(--status-complete-bg)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
        }}
      >
        <MailCheck
          className="h-8 w-8"
          style={{ color: 'var(--status-complete)' }}
          aria-hidden="true"
        />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-2">
        <h2
          className="text-xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Check your email
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          We&apos;ve sent a password reset link to{' '}
          <span
            className="font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {email}
          </span>
          . It expires in 15 minutes.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Didn&apos;t receive it? Check your spam folder or try again.
        </p>
      </div>

      {/* Back to login */}
      <Link
        href="/login"
        className={cn(
          'mt-2 flex items-center gap-1.5 text-sm font-medium',
          'transition-colors duration-150 hover:underline'
        )}
        style={{ color: 'var(--accent-primary)' }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage(): JSX.Element {
  // 8a. State hooks
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')

  // 8b. External hooks
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  // 8d. Event handlers
  const onSubmit = async (data: ForgotPasswordInput): Promise<void> => {
    // Fire-and-forget — always show success to prevent email enumeration
    void fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email }),
    })

    setSubmittedEmail(data.email)
    setSubmitted(true)
  }

  // 8f. JSX return
  return (
    <div
      className="w-full max-w-[440px] rounded-xl border p-8 shadow-[var(--shadow-lg)]"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {submitted ? (
        <SuccessView email={submittedEmail} />
      ) : (
        <>
          {/* Heading */}
          <div className="mb-7 text-center">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Forgot your password?
            </h1>
            <p
              className="mt-1.5 text-sm leading-relaxed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              No problem. Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-5">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="email"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
                {...register('email')}
                className={cn(
                  'h-10 rounded-md border px-3 text-sm transition-colors duration-150',
                  errors.email && 'border-[var(--status-error)]'
                )}
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderColor: errors.email ? undefined : 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
              {errors.email && (
                <p className="text-xs" style={{ color: 'var(--status-error)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              className={cn(
                'h-10 w-full gap-2 font-semibold',
                'active:scale-[0.98] transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
                color: 'white',
                boxShadow: isSubmitting ? 'none' : 'var(--shadow-glow)',
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <InlineSpinner />
                  Sending…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Send Reset Link
                </span>
              )}
            </Button>
          </div>

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium',
                'transition-colors duration-150 hover:underline'
              )}
              style={{ color: 'var(--text-tertiary)' }}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </>
      )}
    </div>
  )
}