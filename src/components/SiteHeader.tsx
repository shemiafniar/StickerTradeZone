import Link from "next/link";
import Image from "next/image";
import { getCurrentProfile } from "@/lib/data/profile";
import { signOutAction } from "@/lib/actions/auth";
import { MobileNav, type NavItem } from "@/components/MobileNav";
import { DesktopNav } from "@/components/DesktopNav";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export async function SiteHeader() {
  const profile = await getCurrentProfile();

  const loggedInItems: NavItem[] = [
    { href: "/dashboard", label: "לוח בקרה" },
    { href: "/dashboard/stickers", label: "האוסף שלי" },
    { href: "/dashboard/matches", label: "התאמות" },
    { href: "/dashboard/trades", label: "טריידים" },
    { href: "/dashboard/support", label: "תקלות ומשוב", icon: "🛟" },
    { href: "/dashboard/changelog", label: "מה חדש", icon: "🆕" },
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
        <Link href={profile ? "/dashboard" : "/"} className="flex items-center" aria-label="Shashot">
          <Image
            src="/branding/logo-horizontal.png"
            alt="Shashot"
            width={169}
            height={44}
            priority
            className="h-11 w-auto"
          />
        </Link>

        <div className="flex items-center gap-1">
          <DesktopNav items={items} />
          <div className="hidden items-center sm:flex">
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
                className="mr-1 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark hover:shadow"
              >
                הצטרפו עכשיו
              </Link>
            )}
          </div>

          {profile && <NotificationBell />}

          <MobileNav items={items} signOutAction={profile ? signOutAction : undefined} />
        </div>
      </div>
    </header>
  );
}
