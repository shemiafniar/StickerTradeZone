import Link from "next/link";
import { getCurrentProfile } from "@/lib/data/profile";
import { signOutAction } from "@/lib/actions/auth";
import { MobileNav, type NavItem } from "@/components/MobileNav";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  const loggedInItems: NavItem[] = [
    { href: "/dashboard", label: "לוח בקרה" },
    { href: "/dashboard/stickers", label: "המדבקות שלי" },
    { href: "/dashboard/matches", label: "התאמות" },
    { href: "/dashboard/trades", label: "טריידים" },
    { href: "/dashboard/profile", label: "פרופיל" },
  ];

  if (profile?.role === "admin") {
    loggedInItems.push({ href: "/admin", label: "אזור ניהול" });
  }

  const items: NavItem[] = profile
    ? loggedInItems
    : [
        { href: "/login", label: "התחברות" },
        { href: "/register", label: "הרשמה" },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="relative mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link href={profile ? "/dashboard" : "/"} className="flex items-center gap-2 font-extrabold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg text-white">
            ⚽
          </span>
          <span className="text-lg text-foreground">
            Sticker Trade <span className="text-brand-dark">IL</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition hover:bg-black/5 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {profile && (
            <form action={signOutAction}>
              <button className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">
                התנתקות
              </button>
            </form>
          )}
          {!profile && (
            <Link
              href="/register"
              className="mr-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
            >
              הצטרפו עכשיו
            </Link>
          )}
        </nav>

        <MobileNav items={items} signOutAction={profile ? signOutAction : undefined} />
      </div>
    </header>
  );
}
