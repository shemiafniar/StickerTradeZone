import { headers } from "next/headers";

/**
 * Best-effort client IP for rate-limiting keys. Trusts the platform's
 * forwarded-for header (set by Vercel's edge network); falls back to a
 * constant so unauthenticated actions still get *some* shared bucket
 * instead of throwing when headers are missing (e.g. in tests).
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = headerList.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
