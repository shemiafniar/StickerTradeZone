import { getCurrentContact, getCurrentProfile } from "@/lib/data/profile";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { LocationToggle } from "@/components/location/LocationToggle";
import { ShareCard } from "@/components/share/ShareCard";

export const metadata = { title: "פרופיל | Sticker Trade IL" };

export default async function ProfilePage() {
  const [profile, contact] = await Promise.all([getCurrentProfile(), getCurrentContact()]);
  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">הפרופיל שלי</h1>
        <p className="mb-6 text-sm text-foreground/60">עדכנו את הפרטים שלכם כדי שאספנים ימצאו אתכם</p>
      </div>

      <Card>
        <ProfileForm profile={profile} contact={contact} />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-bold">מיקום להתאמות מדויקות יותר</h2>
        <LocationToggle enabled={profile.location_enabled} />
      </Card>

      <ShareCard />
    </div>
  );
}
