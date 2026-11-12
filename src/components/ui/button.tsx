import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-secondary hover:border-primary/40",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-gradient-primary text-primary-foreground shadow-glow hover:shadow-elegant hover:-translate-y-0.5 hover:scale-[1.02]",
      },
      // Em telas de toque (pointer: coarse) a área mínima é 44×44px; com mouse
      // os tamanhos seguem iguais.
      size: {
        default: "h-10 px-4 py-2 [@media(pointer:coarse)]:min-h-11",
        sm: "h-9 rounded-lg px-3.5 [@media(pointer:coarse)]:min-h-11",
        lg: "h-12 rounded-xl px-7 text-base",
        xl: "h-14 rounded-2xl px-9 text-base",
        icon: "h-10 w-10 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
        "icon-sm": "h-8 w-8 rounded-lg [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
