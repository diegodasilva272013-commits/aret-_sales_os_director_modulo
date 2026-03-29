import { cn } from '@/lib/utils'

type BadgeVariant = 'top' | 'bueno' | 'revisar' | 'coaching' | 'alerta' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  top: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  bueno: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  revisar: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  coaching: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  alerta: 'bg-red-500/20 text-red-400 border border-red-500/30',
  default: 'bg-gray-700/50 text-gray-300 border border-gray-600/30',
}

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  )
}
