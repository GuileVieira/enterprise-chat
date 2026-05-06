import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 ease-out active:translate-y-px active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm shadow-black/10 hover:bg-primary/90 hover:shadow-md hover:shadow-black/10 dark:shadow-black/30',
        destructive:
          'bg-surface-destructive text-destructive-foreground shadow-sm shadow-red-950/10 hover:bg-surface-destructive-hover',
        outline:
          'border border-border-light bg-surface-primary/60 text-text-primary shadow-sm shadow-black/[0.03] hover:border-border-medium hover:bg-surface-secondary hover:text-text-primary dark:shadow-black/20',
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm shadow-black/[0.03] hover:bg-secondary/80 dark:shadow-black/20',
        ghost: 'hover:bg-surface-hover hover:text-text-primary',
        link: 'text-primary underline-offset-4 hover:underline',
        // hardcoded text color because of WCAG contrast issues (text-white)
        submit:
          'bg-surface-submit text-white shadow-sm shadow-emerald-950/20 hover:bg-surface-submit-hover hover:shadow-md hover:shadow-emerald-950/20',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-lg px-3',
        lg: 'h-11 rounded-lg px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
