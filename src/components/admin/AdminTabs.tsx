"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/admin", label: "סקירה כללית" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/stickers", label: "קטלוג מדבקות" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl bg-black/5 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition",
            pathname === tab.href ? "bg-white text-brand-dark shadow-sm" : "text-foreground/70 hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
