import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full bg-[#0D1117] border rounded-lg px-3.5 py-2.5 text-gray-100 placeholder-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50',
            'transition-all duration-200',
            error ? 'border-red-500/70' : 'border-gray-700/80',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        {helper && !error && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
