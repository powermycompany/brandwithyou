// src/components/ui/Button.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium",
          "bg-black text-white dark:bg-white dark:text-black",
          "hover:opacity-90 transition",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
