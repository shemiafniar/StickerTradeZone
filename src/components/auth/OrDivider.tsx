export function OrDivider({ label = "או המשיכו עם אימייל" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-black/10" />
      <span className="text-xs font-medium text-foreground/40">{label}</span>
      <div className="h-px flex-1 bg-black/10" />
    </div>
  );
}
