'use client'

// 1. React imports
import { useState, useCallback } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// 3. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Eye, EyeOff, Check } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 5. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — validation, utils
import { registerSchema, type RegisterInput } from '@/validations/auth'
import { cn } from '@/lib/utils'

// ─── Password strength helpers ────────────────────────────────────────────────

interface StrengthInfo {
  score: number // 0–4
  label: string
  color: string
  bgColor: string
}

function computePasswordStrength(password: string): StrengthInfo {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const map: Record<number, Omit<StrengthInfo, 'score'>> = {
    0: { label: '', color: 'var(--border-emphasis)', bgColor: 'var(--border-emphasis)' },
    1: { label: 'Weak', color: 'var(--status-error)', bgColor: 'var(--status-error)' },
    2: { label: 'Fair', color: 'var(--status-in-progress)', bgColor: 'var(--status-in-progress)' },
    3: { label: 'Strong', color: '#60a5fa', bgColor: '#60a5fa' },
    4: { label: 'Very Strong', color: 'var(--status-complete)', bgColor: 'var(--status-complete)' },
  }

  return { score, ...map[score] }
}

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    watch,
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  })

  const watchedPassword = watch('password', '')
  const strength = computePasswordStrength(watchedPassword)
  const strengthPercent = (strength.score / 4) * 100

  const onSubmit = useCallback(
    async (data: RegisterInput): Promise<void> => {
      // Step 1 — create account (send all 4 fields so Zod refine can validate)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      })

      if (res.status === 409) {
        toast.error('An account with this email already exists')
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error ?? 'Failed to create account. Please try again.')
        return
      }

      // Step 2 — sign in automatically
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error('Account created! Please sign in to continue.')
        router.push('/login')
        return
      }

      router.push('/dashboard')
    },
    [router]
  )

  const handleGoogleSignIn = async (): Promise<void> => {
    setIsGoogleLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      toast.error('Failed to sign in with Google')
      setIsGoogleLoading(false)
    }
  }

  const canSubmit = isValid && termsAccepted && !isSubmitting

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
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Create your account
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Start building AI-assisted projects today
        </p>
      </div>

      <div className="flex flex-col gap-4">

        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Full name
          </Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Ada Lovelace"
            {...register('name')}
            className={cn(
              'h-10 rounded-md border px-3 text-sm transition-colors duration-150',
              errors.name && 'border-[var(--status-error)]'
            )}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderColor: errors.name ? undefined : 'var(--border-default)',
              color: 'var(--text-primary)',
            }}
          />
          {errors.name && (
            <p className="text-xs" style={{ color: 'var(--status-error)' }}>
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
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

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('password')}
              className={cn(
                'h-10 w-full rounded-md border px-3 pr-10 text-sm transition-colors duration-150',
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
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Password strength bar */}
          {watchedPassword.length > 0 && (
            <div className="flex flex-col gap-1 mt-0.5">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-quaternary)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${strengthPercent}%`, backgroundColor: strength.bgColor }}
                />
              </div>
              {strength.label && (
                <p className="text-xs font-medium" style={{ color: strength.color }}>
                  {strength.label}
                </p>
              )}
            </div>
          )}

          {errors.password && (
            <p className="text-xs" style={{ color: 'var(--status-error)' }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={cn(
                'h-10 w-full rounded-md border px-3 pr-10 text-sm transition-colors duration-150',
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
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150"
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

        {/* Terms checkbox */}
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-lg border p-3',
            'transition-colors duration-150',
            termsAccepted ? 'border-[var(--accent-border)]' : 'border-[var(--border-subtle)]'
          )}
          style={{ backgroundColor: termsAccepted ? 'var(--accent-light)' : 'var(--bg-secondary)' }}
        >
          <span
            onClick={() => setTermsAccepted((v) => !v)}
            role="checkbox"
            aria-checked={termsAccepted}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                setTermsAccepted((v) => !v)
              }
            }}
            className={cn(
              'mt-0.5 flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center',
              'rounded border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]',
              'focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-secondary)]'
            )}
            style={{
              borderColor: termsAccepted ? 'var(--accent-primary)' : 'var(--border-emphasis)',
              backgroundColor: termsAccepted ? 'var(--accent-primary)' : 'transparent',
            }}
          >
            {termsAccepted && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </span>

          <span className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            I agree to the{' '}
            <Link
              href="/terms"
              className="underline transition-colors duration-150 hover:no-underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="underline transition-colors duration-150 hover:no-underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        {/* Submit */}
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={!canSubmit}
          className={cn(
            'h-10 w-full font-semibold',
            'active:scale-[0.98] transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
          )}
          style={{
            background: canSubmit
              ? 'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)'
              : 'var(--bg-quaternary)',
            color: canSubmit ? 'white' : 'var(--text-tertiary)',
            boxShadow: canSubmit ? 'var(--shadow-glow)' : 'none',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <InlineSpinner />
              Creating account…
            </span>
          ) : (
            'Create Account'
          )}
        </Button>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>or</span>
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
        </div>

        {/* Google OAuth */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className={cn(
            'h-10 w-full gap-2.5 font-medium',
            'active:scale-[0.98] transition-all duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        >
          {isGoogleLoading ? <InlineSpinner /> : <GoogleIcon />}
          Continue with Google
        </Button>
      </div>

      {/* Login link */}
      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Already have an account?{' '}
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