import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ShareButtons } from "@/components/share/ShareButtons";
import { getSiteUrl } from "@/lib/site";
import { getCurrentProfile } from "@/lib/data/profile";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const [profile, siteUrl] = await Promise.all([getCurrentProfile(), getSiteUrl()]);
  if (profile) redirect("/dashboard");

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-brand/10 via-white to-white px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-5 inline-block rounded-full bg-brand/10 px-4 py-1.5 text-sm font-bold text-brand-dark">
            קהילת אספני מדבקות כדורגל בישראל ⚽
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-6xl">
            מסיימים את האלבום <span className="text-brand-dark">מהר יותר</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-foreground/70">
            נהלו את הכפולים והחוסרים שלכם, ומצאו אספנים קרובים אליכם להחלפה או לקנייה - מהר, פשוט
            וללא עלות.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/register" size="lg" className="w-full sm:w-auto">
              התחל למצוא טריידים
            </LinkButton>
            <LinkButton href="/login" variant="outline" size="lg" className="w-full sm:w-auto">
              כבר יש לי חשבון
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-4 pb-16 sm:grid-cols-3">
        <Card>
          <div className="mb-3 text-3xl">🔁</div>
          <h3 className="mb-1 text-lg font-bold">הקלפים שיש לי להחלפה</h3>
          <p className="text-sm text-foreground/60">
            סמנו במהירות אילו מדבקות יש לכם בכפילות, ובחרו אילו זמינות גם למכירה.
          </p>
        </Card>
        <Card>
          <div className="mb-3 text-3xl">📋</div>
          <h3 className="mb-1 text-lg font-bold">הקלפים שחסרים לי</h3>
          <p className="text-sm text-foreground/60">
            עדכנו את רשימת החוסרים שלכם בקלות עם הזנה מהירה של טווחי מספרים.
          </p>
        </Card>
        <Card>
          <div className="mb-3 text-3xl">📍</div>
          <h3 className="mb-1 text-lg font-bold">מצא טריידים קרובים</h3>
          <p className="text-sm text-foreground/60">
            המערכת מדרגת אספנים קרובים אליכם עיר-אחר-עיר, כדי שתוכלו להיפגש בקלות.
          </p>
        </Card>
      </section>

      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-8 text-center text-2xl font-extrabold sm:text-3xl">איך זה עובד?</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
            {[
              { step: "1", title: "נרשמים", text: "יוצרים פרופיל עם עיר ומספר וואטסאפ" },
              { step: "2", title: "מסמנים מדבקות", text: "אילו יש לכם כפול ואילו חסרות לכם" },
              { step: "3", title: "מוצאים התאמות", text: "רואים מי קרוב אליכם ומתאים להחלפה" },
              { step: "4", title: "שולחים בקשת טרייד", text: "לאחר אישור נחשפים פרטי הקשר" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-lg font-extrabold text-white">
                  {item.step}
                </div>
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-sm text-foreground/60">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl rounded-3xl bg-brand px-6 py-10 text-center text-white">
          <h2 className="text-2xl font-extrabold sm:text-3xl">מוכנים להשלים את האוסף?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/90">
            הצטרפו לקהילת האספנים ומצאו טריידים ליד הבית עוד היום.
          </p>
          <LinkButton href="/register" variant="secondary" size="lg" className="mt-6">
            הרשמה חינם
          </LinkButton>

          <div className="mt-6 flex justify-center">
            <ShareButtons url={siteUrl} compact />
          </div>
        </div>
      </section>
    </div>
  );
}
