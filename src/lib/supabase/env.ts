/**
 * Fails fast with an actionable message instead of the cryptic
 * "supabaseUrl is required" error supabase-js throws when these are
 * missing/blank - the most common cause of a "works locally, broken on
 * Vercel" deploy is simply forgetting to set these two env vars.
 */
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY (copy .env.example to .env.local locally, or add " +
        "them in your Vercel project's Environment Variables). See the README's " +
        "'Getting started' / 'Deploying to Vercel + Supabase' sections."
    );
  }

  return { url, anonKey };
}
