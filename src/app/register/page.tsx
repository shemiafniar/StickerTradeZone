import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "הרשמה | Sticker Trade IL" };

export default function RegisterPage() {
  return (
    <AuthShell title="יוצרים חשבון אספן" subtitle="דקה אחת של הרשמה, ואז ישר להחלפות">
      <RegisterForm />
    </AuthShell>
  );
}
