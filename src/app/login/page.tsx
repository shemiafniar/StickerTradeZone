import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { ErrorMessage } from "@/components/ui/FormMessage";

export const metadata = { title: "התחברות | Sticker Trade IL" };

const errorMessages: Record<string, string> = {
  confirmation_failed:
    "אימות המייל נכשל או שהקישור פג תוקף. נסו להתחבר עם הסיסמה שלכם, או להירשם מחדש כדי לקבל מייל אימות חדש.",
  oauth_failed: "ההתחברות עם Google לא הושלמה. אפשר לנסות שוב, או להתחבר עם אימייל וסיסמה.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <AuthShell title="ברוכים השבים!" subtitle="התחברו כדי להמשיך להחליף מדבקות">
      {error && <ErrorMessage message={errorMessages[error] ?? errorMessages.confirmation_failed} />}
      <LoginForm next={next} />
    </AuthShell>
  );
}
