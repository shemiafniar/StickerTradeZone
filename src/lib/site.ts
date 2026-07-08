import { headers } from "next/headers";

const PLACEHOLDER_SITE_URL = "https://shashot.app";

/**
 * Resolves the app's public URL for building absolute links (share links,
 * the auth email confirmation redirect, etc).
 *
 * Prefers `NEXT_PUBLIC_SITE_URL` when it's set to something other than the
 * placeholder default. Otherwise, derives it from the incoming request's
 * forwarded host/proto headers (which Vercel always sets correctly to the
 * live deployment URL) - so a fresh deploy works correctly even if that env
 * var is never configured, rather than silently sending auth confirmation
 * emails to a domain nobody owns.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured && configured !== PLACEHOLDER_SITE_URL) {
    return configured.replace(/\/$/, "");
  }

  try {
    const headerList = await headers();
    const forwardedHost = headerList.get("x-forwarded-host") ?? headerList.get("host");
    const forwardedProto =
      headerList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "development" ? "http" : "https");

    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }
  } catch {
    // headers() is unavailable outside a request context (e.g. static
    // generation) - fall through to the configured/placeholder value below.
  }

  return configured ?? PLACEHOLDER_SITE_URL;
}
