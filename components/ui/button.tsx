import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-sans font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-paper hover:bg-ink/85 rounded-md",
        ghost: "text-accent hover:text-accent-hover bg-transparent",
      },
      size: {
        default: "h-11 px-6 text-[13px] tracking-[0.01em]",
        link: "h-auto p-0 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = "Button"
