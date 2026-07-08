import { ScannerApp } from "@/components/scanner/ScannerApp";

export const metadata = { title: "סורק AI | Shashot" };

export default function ScannerPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold">סורק המדבקות החכם 🤖</h1>
      <p className="mb-6 text-sm text-foreground/60">
        צלמו כפולים או עמוד אלבום, והמערכת תעדכן את הרשימות שלכם אוטומטית - בלי להקליד מספרים
        אחד-אחד.
      </p>

      <ScannerApp />
    </div>
  );
}
