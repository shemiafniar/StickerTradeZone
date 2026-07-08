"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

export function MobileNav({
  items,
  signOutAction,
}: {
  items: NavItem[];
  signOutAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="פתח תפריט"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-black/10 text-foreground"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-16 z-40 border-b border-black/5 bg-white shadow-lg">
          <nav className="flex flex-col p-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-3 text-base font-medium ${
                  pathname === item.href ? "bg-brand/10 text-brand-dark" : "text-foreground/80"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {signOutAction && (
              <form action={signOutAction}>
                <button className="w-full rounded-lg px-4 py-3 text-right text-base font-medium text-red-600">
                  התנתקות
                </button>
              </form>
            )}
          </nav>
        </div>
      )}
    </div>
  );
}
