import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "התחברות | Sticker Trade IL" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthShell title="ברוכים השבים!" subtitle="התחברו כדי להמשיך להחליף מדבקות">
      <LoginForm next={next} />
    </AuthShell>
  );
}
