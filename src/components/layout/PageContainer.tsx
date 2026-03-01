// 1. Third-party library imports
import { motion } from 'framer-motion'

// 2. Internal imports — utils
import { cn } from '@/lib/utils'

// 3. Local types
interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('p-6 md:p-8 max-w-none w-full', className)}
    >
      {children}
    </motion.div>
  )
}

export default PageContainer