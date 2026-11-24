import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

const VARIANTS = {
  default: 'bg-[color:var(--color-ai)] text-primary-foreground hover:opacity-90 shadow-sm',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-muted text-muted-foreground hover:bg-muted/80',
  ghost: 'hover:bg-muted/50 hover:text-foreground',
  link: 'text-primary underline-offset-4 hover:underline',
  success: 'bg-[color:var(--color-success)] text-white hover:opacity-90 shadow-sm',
};

const SIZES = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs rounded-md',
  xs: 'h-7 px-2.5 text-[11px] rounded-md',
  lg: 'h-10 px-8 text-sm rounded-md',
  icon: 'h-9 w-9',
};

const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          VARIANTS[variant] || VARIANTS.default,
          SIZES[size] || SIZES.default,
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
