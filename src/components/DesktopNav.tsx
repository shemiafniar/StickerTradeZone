"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/components/MobileNav";

/**
 * Desktop nav links with active-route highlighting, matching MobileNav's
 * treatment (brand-green tint + bold text on the current route) - the
 * original inline .map() in SiteHeader had no active state at all, which
 * was the one nav-consistency gap the branding pass called out.
 */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand/10 text-brand-dark" : "text-foreground/70 hover:bg-black/5 hover:text-foreground"
            )}
          >
            {item.icon && <span className="ml-1">{item.icon}</span>}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
