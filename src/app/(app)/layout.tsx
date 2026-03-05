// 1. Next.js imports
import { redirect } from 'next/navigation'

// 2. Auth
import { getServerSession } from '@/lib/auth'
import { authOptions } from '@/lib/auth'

// 3. Internal imports — layout components
import AppShell from '@/components/layout/AppShell'
import { QuickPromptsPanel } from '@/components/shared/QuickPromptsPanel'

// 4. Local types
interface AppLayoutProps {
  children: React.ReactNode
}

export default async function AppLayout({ children }: AppLayoutProps): Promise<JSX.Element> {
  const session = await getServerSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <AppShell>
      {children}
      <QuickPromptsPanel />
    </AppShell>
  )
}