'use client'

// 1. React imports
import { useState, useCallback, Suspense } from 'react'

// 2. Next.js imports
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// 3. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Eye, EyeOff, ShieldCheck, AlertTriangle } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 5. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — validation, utils
import { type ResetPasswordInput } from '@/validations/auth'
import { cn } from '@/lib/utils'
import { z } from 'zod'

// ─── Local types ──────────────────────────────────────────────────────────────

// Form fields — token injected from URL, not a visible field
type ResetFormFields = {
  password: string
  confirmPassword: string
}

// ─── Invalid token state ──────────────────────────────────────────────────────

function InvalidTokenState(): JSX.Element {
  return (
    <div
      className="w-full max-w-[440px] rounded-xl border p-8 shadow-[var(--shadow-lg)] text-center"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--status-error-bg)' }}
      >
        <AlertTriangle
          className="h-7 w-7"
          style={{ color: 'var(--status-error)' }}
          aria-hidden="true"
        />
      </div>

      <h1
        className="text-xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        Invalid reset link
      </h1>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: 'var(--text-tertiary)' }}
      >
        This password reset link is missing or invalid. Reset links expire
        after a short time for security.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="/forgot-password"
          className={cn(
            'flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold',
            'transition-all duration-150 active:scale-[0.98]'
          )}
          style={{
            background:
              'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
            color: 'white',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          Request a new link
        </Link>
        <Link
          href="/login"
          className={cn(
            'flex h-10 w-full items-center justify-center rounded-md text-sm font-medium',
            'border transition-colors duration-150',
            'hover:text-[var(--text-primary)]'
          )}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)',
          }}
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessState(): JSX.Element {
  return (
    <div
      className="w-full max-w-[440px] rounded-xl border p-8 shadow-[var(--shadow-lg)] text-center"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--status-complete-bg)' }}
      >
        <ShieldCheck
          className="h-7 w-7"
          style={{ color: 'var(--status-complete)' }}
          aria-hidden="true"
        />
      </div>

      <h1
        className="text-xl font-bold tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        Password updated
      </h1>
      <p
        className="mt-2 text-sm leading-relaxed"
        style={{ color: 'var(--text-tertiary)' }}
      >
        Your password has been reset successfully. You can now sign in with
        your new password.
      </p>

      <Link
        href="/login"
        className={cn(
          'mt-6 flex h-10 w-full items-center justify-center rounded-md text-sm font-semibold',
          'transition-all duration-150 active:scale-[0.98]'
        )}
        style={{
          background:
            'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
          color: 'white',
          boxShadow: 'var(--shadow-glow)',
        }}
      >
        Sign in
      </Link>
    </div>
  )
}

// ─── Inner component (uses useSearchParams — must be inside Suspense) ─────────

function ResetPasswordContent(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormFields>({
    resolver: zodResolver(
      z.object({ password: z.string().min(8), confirmPassword: z.string().min(8) })
    ),
  })

  const onSubmit = useCallback(
    async (data: ResetFormFields): Promise<void> => {
      const payload: ResetPasswordInput = {
        token: token as string,
        password: data.password,
        confirmPassword: data.confirmPassword,
      }

      setServerError(null)

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          toast.success('Password reset successfully')
          setIsSuccess(true)
          setTimeout(() => {
            router.push('/login')
          }, 2500)
          return
        }

        const body = await res.json().catch(() => ({}))

        if (res.status === 400 || res.status === 410) {
          setServerError(
            body?.error ??
              'This reset link has expired or already been used. Please request a new one.'
          )
          return
        }

        setServerError('Something went wrong. Please try again.')
      } catch {
        setServerError('Unable to reach the server. Please check your connection.')
      }
    },
    [token, router]
  )

  // ── Early exits ──────────────────────────────────────────────────────────────

  if (!token) {
    return <InvalidTokenState />
  }

  if (isSuccess) {
    return <SuccessState />
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full max-w-[440px] rounded-xl border p-8 shadow-[var(--shadow-lg)]"
      style={{
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Heading */}
      <div className="mb-7 text-center">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Set new password
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Choose a strong password for your account
        </p>
      </div>

      {/* Server error banner */}
      {serverError && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg border p-3"
          style={{
            backgroundColor: 'var(--status-error-bg)',
            borderColor: 'rgba(239,68,68,0.2)',
          }}
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 flex-shrink-0"
            style={{ color: 'var(--status-error)' }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <p className="text-xs leading-relaxed" style={{ color: 'var(--status-error)' }}>
              {serverError}
            </p>
            {(serverError.includes('expired') || serverError.includes('used')) && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium underline transition-colors duration-150 hover:no-underline"
                style={{ color: 'var(--status-error)' }}
              >
                Request a new link →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="flex flex-col gap-5">

        {/* New Password */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="password"
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            New password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'h-10 w-full rounded-md border px-3 pr-10 text-sm',
                'transition-colors duration-150',
                errors.password && 'border-[var(--status-error)]'
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: errors.password ? undefined : 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'flex h-5 w-5 items-center justify-center',
                'transition-colors duration-150'
              )}
              style={{ color: 'var(--text-tertiary)' }}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs" style={{ color: 'var(--status-error)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="confirmPassword"
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Confirm new password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={cn(
                'h-10 w-full rounded-md border px-3 pr-10 text-sm',
                'transition-colors duration-150',
                errors.confirmPassword && 'border-[var(--status-error)]'
              )}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: errors.confirmPassword ? undefined : 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2',
                'flex h-5 w-5 items-center justify-center',
                'transition-colors duration-150'
              )}
              style={{ color: 'var(--text-tertiary)' }}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs" style={{ color: 'var(--status-error)' }}>
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className={cn(
            'h-10 w-full font-semibold',
            'active:scale-[0.98] transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
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
              Resetting password…
            </span>
          ) : (
            'Reset password'
          )}
        </Button>
      </div>

      {/* Back to login */}
      <p
        className="mt-6 text-center text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        Remember your password?{' '}
        <Link
          href="/login"
          className="font-medium transition-colors duration-150 hover:underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}

// ─── Page export — Suspense required because ResetPasswordContent uses useSearchParams ──

export default function ResetPasswordPage(): JSX.Element {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center" />}>
      <ResetPasswordContent />
    </Suspense>
  )
}