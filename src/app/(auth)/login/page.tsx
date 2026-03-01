'use client'

// 1. React imports
import { useState } from 'react'

// 2. Next.js imports
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// 3. Third-party library imports
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'

// 4. Internal imports — UI components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 5. Internal imports — shared components
import { InlineSpinner } from '@/components/shared/LoadingSpinner'

// 6. Internal imports — validation, utils
import { loginSchema, type LoginInput } from '@/validations/auth'
import { cn } from '@/lib/utils'

// 7. Google icon SVG
function GoogleIcon(): JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

// 8. Component definition
export default function LoginPage(): JSX.Element {
  // 8a. State hooks
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // 8b. External hooks
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // 8d. Event handlers
  const onSubmit = async (data: LoginInput): Promise<void> => {
    const result = await signIn('credentials', {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      toast.error('Incorrect email or password')
      return
    }

    router.push('/dashboard')
  }

  const handleGoogleSignIn = async (): Promise<void> => {
    setIsGoogleLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      toast.error('Failed to sign in with Google')
      setIsGoogleLoading(false)
    }
  }

  // 8f. JSX return
  return (
    <div
      className={cn(
        'w-full max-w-[440px] rounded-xl border p-8',
        'shadow-[var(--shadow-lg)]'
      )}
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
          Welcome back
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Sign in to your DevForge account
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-col gap-5">
        {/* Email */}
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
            {...register('email')}
            className={cn(
              'h-10 rounded-md border px-3 text-sm',
              'transition-colors duration-150',
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
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              className="text-xs transition-colors duration-150 hover:underline"
              style={{ color: 'var(--accent-primary)' }}
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
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
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {errors.password && (
            <p className="text-xs" style={{ color: 'var(--status-error)' }}>
              {errors.password.message}
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
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #818cf8 100%)',
            color: 'white',
            boxShadow: isSubmitting ? 'none' : 'var(--shadow-glow)',
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <InlineSpinner />
              Signing in…
            </span>
          ) : (
            'Sign in'
          )}
        </Button>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            or
          </span>
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
          {isGoogleLoading ? (
            <InlineSpinner />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </Button>
      </div>

      {/* Register link */}
      <p
        className="mt-6 text-center text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium transition-colors duration-150 hover:underline"
          style={{ color: 'var(--accent-primary)' }}
        >
          Create one
        </Link>
      </p>
    </div>
  )
}