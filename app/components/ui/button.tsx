import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const buttonVariants = cva('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold tracking-tight ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
    variants: {
        variant: {
            default: 'bg-primary text-primary-foreground-strong hover:bg-primary-dark hover:shadow-[0_8px_24px_-8px_rgba(27,77,50,0.5)]',
            destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            outline: 'border border-primary/30 bg-transparent text-primary hover:border-primary hover:bg-primary-dark hover:text-white',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border/60',
            ghost: 'hover:bg-secondary hover:text-secondary-foreground',
            link: 'text-primary underline-offset-4 hover:underline',
            light: 'bg-secondary text-primary hover:bg-primary-dark hover:text-white border border-primary/10',
            cream: 'bg-secondary text-primary hover:bg-primary-dark hover:text-white border border-primary/10',
        },
        size: {
            default: 'h-10 px-4',
            sm: 'h-9 px-3.5 text-[13px]',
            lg: 'h-11 px-6 text-[15px]',
            icon: 'h-9 w-9',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (<Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}/>);
});
Button.displayName = 'Button';
export { Button, buttonVariants };
