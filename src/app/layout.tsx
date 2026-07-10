import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { NotificationsRootProvider } from "@/components/notifications/NotificationsRootProvider";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Shashot | אזור החלפת מדבקות לאספנים",
    template: "%s | Shashot",
  },
  description:
    "פלטפורמת קהילה עצמאית לאספני מדבקות כדורגל בישראל - נהלו כפולים וחוסרים ומצאו טריידים קרובים אליכם. אינה קשורה ל-Panini, FIFA או כל מותג רשמי.",
  // No explicit `icons` field needed - favicon.ico and apple-icon.png in
  // src/app/ (copies of public/branding/favicon.ico and
  // apple-touch-icon.png) are picked up automatically by Next.js's file
  // convention, which avoids emitting a duplicate/conflicting <link> tag.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101c34",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NotificationsRootProvider>
          <SiteHeader />
          <main className="flex-1 flex flex-col">{children}</main>
          <SiteFooter />
        </NotificationsRootProvider>
      </body>
    </html>
  );
}
