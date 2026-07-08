import { getCurrentContact, getCurrentProfile } from "@/lib/data/profile";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/profile/ProfileForm";

export const metadata = { title: "פרופיל | Sticker Trade IL" };

export default async function ProfilePage() {
  const [profile, contact] = await Promise.all([getCurrentProfile(), getCurrentContact()]);
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold">הפרופיל שלי</h1>
      <p className="mb-6 text-sm text-foreground/60">עדכנו את הפרטים שלכם כדי שאספנים ימצאו אתכם</p>

      <Card>
        <ProfileForm profile={profile} contact={contact} />
      </Card>
    </div>
  );
}
