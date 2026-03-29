import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  accent?: 'indigo' | 'green' | 'yellow' | 'red' | 'violet'
}

export default function Card({ className, glow, accent, children, ...props }: CardProps) {
  const accentColors = {
    indigo: 'border-t-indigo-500',
    green: 'border-t-emerald-500',
    yellow: 'border-t-amber-500',
    red: 'border-t-red-500',
    violet: 'border-t-violet-500',
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-800 bg-[#111827] p-4',
        accent && 'border-t-2',
        accent && accentColors[accent],
        glow && 'glow-indigo',
        'card-hover',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
