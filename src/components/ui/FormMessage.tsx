export function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </div>
  );
}

export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
      {message}
    </div>
  );
}
