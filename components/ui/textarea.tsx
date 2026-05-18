import * as React from "react"
import { cn } from "@/lib/utils"

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      suppressHydrationWarning
      data-clarity-mask="True"
      className={cn(
        "w-full resize-none rounded-md border border-divider bg-paper px-6 py-5",
        "font-serif text-[17px] leading-[1.65] text-ink",
        "placeholder:text-ink-dimmed/70",
        "transition-colors duration-200",
        "focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15",
        "disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
