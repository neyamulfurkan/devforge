// 1. Internal imports — shared components
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export default function AppLoading(): JSX.Element {
  return (
    <div
      className="flex min-h-[calc(100vh-52px)] items-center justify-center"
      role="status"
      aria-label="Loading page"
    >
      <LoadingSpinner size={32} />
    </div>
  )
}