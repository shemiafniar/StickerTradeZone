"use client";

import { useFormStatus } from "react-dom";
import { Button, type Variant, type Size } from "@/components/ui/Button";
import type { ButtonHTMLAttributes } from "react";

export function SubmitButton({
  children,
  pendingText = "רגע, שומר/ת...",
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; variant?: Variant; size?: Size }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
