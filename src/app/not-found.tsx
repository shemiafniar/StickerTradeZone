import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 text-5xl">🔍</span>
      <h1 className="mb-2 text-2xl font-extrabold">הדף לא נמצא</h1>
      <p className="mb-6 max-w-sm text-sm text-foreground/60">
        ייתכן שהקישור שגוי או שהדף הוסר. בואו נחזור למקום מוכר.
      </p>
      <LinkButton href="/dashboard">חזרה ללוח הבקרה</LinkButton>
    </div>
  );
}
