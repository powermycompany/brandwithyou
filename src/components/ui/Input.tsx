import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-zinc-300 dark:border-zinc-700",
          "bg-white dark:bg-zinc-900 px-3 py-2 text-sm",
          "placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-700",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
