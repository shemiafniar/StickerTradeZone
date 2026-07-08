import { Card } from "@/components/ui/Card";
import { ShareButtons } from "@/components/share/ShareButtons";
import { getSiteUrl } from "@/lib/site";

export function ShareCard() {
  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">הזמינו חברים לאספנים 🎉</h2>
      <p className="mb-3 text-sm text-foreground/60">
        ככל שיותר אספנים מצטרפים, כך קל יותר למצוא התאמות קרובות. שתפו את הקבוצה שלכם!
      </p>
      <ShareButtons url={getSiteUrl()} />
    </Card>
  );
}
