import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Variant = "primary" | "secondary" | "outline" | "danger" | "ghost" | "light";
export type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-brand-dark hover:shadow-md",
  secondary: "bg-brand-blue text-white shadow-sm hover:bg-brand-blue-dark hover:shadow-md",
  outline: "border border-black/15 text-foreground hover:border-brand-dark/30 hover:bg-brand/5 hover:text-brand-dark",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-foreground/70 hover:bg-black/5",
  // For use on a colored/gradient background (e.g. the closing CTA section)
  // where a solid brand-colored button wouldn't have enough contrast.
  light: "bg-white text-brand-dark shadow-sm hover:bg-white/90 hover:shadow-md",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3.5 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:opacity-50 disabled:pointer-events-none";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button className={cn(base, variantClasses[variant], sizeClasses[size], className)} {...props} />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variantClasses[variant], sizeClasses[size], className)}>
      {children}
    </Link>
  );
}
