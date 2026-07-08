import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Sticker } from "@/types/database";

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  return (data as AppSettings) ?? { id: true, set_name: "אלבום שאשות", total_stickers: 0, updated_at: "" };
}

export async function getStickerCatalog(): Promise<Sticker[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stickers")
    .select("*")
    .order("team_code", { ascending: true })
    .order("number", { ascending: true });
  return (data as Sticker[]) ?? [];
}

export async function getStickerCodeToIdMap(): Promise<Map<string, string>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.code, s.id]));
}

export async function getStickerIdToCodeMap(): Promise<Map<string, string>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.id, s.code]));
}
