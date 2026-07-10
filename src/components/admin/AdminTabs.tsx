"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const tabs = [
  { href: "/admin", label: "סקירה כללית" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/trades", label: "טריידים" },
  { href: "/admin/reports", label: "דיווחי תקלות" },
  { href: "/admin/statistics", label: "סטטיסטיקות" },
  { href: "/admin/stickers", label: "קטלוג מדבקות" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto rounded-xl bg-black/5 p-1">
      {tabs.map((tab) => {
        // "/admin" itself must match exactly (every nested route also starts
        // with "/admin"), but nested tabs like "/admin/users" should stay
        // highlighted on their own sub-routes (e.g. "/admin/users/<id>").
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition",
              active ? "bg-white text-brand-dark shadow-sm" : "text-foreground/70 hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
