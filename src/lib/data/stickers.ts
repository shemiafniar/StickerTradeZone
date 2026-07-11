import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { AppSettings, Sticker } from "@/types/database";

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  return (data as AppSettings) ?? { id: true, set_name: "אלבום שאשות", total_stickers: 0, updated_at: "" };
}

/**
 * The full sticker catalog - currently 960 rows (48 teams x 20), already
 * close enough to Supabase's default 1000-row-per-request cap that adding
 * just a few more teams would silently truncate a bare .select() with no
 * error. Paginated defensively via fetchAllRows() - this function backs
 * the code<->id maps used almost everywhere (matching, admin stats,
 * collection pages, trades), so a silent truncation here would corrupt
 * far more than just this one catalog listing.
 */
export async function getStickerCatalog(): Promise<Sticker[]> {
  const supabase = await createClient();
  return fetchAllRows<Sticker>((from, to) =>
    supabase
      .from("stickers")
      .select("*")
      .order("team_code", { ascending: true })
      .order("number", { ascending: true })
      .range(from, to)
  );
}

export async function getStickerCodeToIdMap(): Promise<Map<string, string>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.code, s.id]));
}

export async function getStickerIdToCodeMap(): Promise<Map<string, string>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.id, s.code]));
}
