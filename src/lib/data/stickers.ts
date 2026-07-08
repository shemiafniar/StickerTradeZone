import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Sticker } from "@/types/database";

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
  return (data as AppSettings) ?? { id: true, set_name: "אלבום המדבקות", total_stickers: 0, updated_at: "" };
}

export async function getStickerCatalog(): Promise<Sticker[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("stickers").select("*").order("number", { ascending: true });
  return (data as Sticker[]) ?? [];
}

export async function getStickerNumberToIdMap(): Promise<Map<number, string>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.number, s.id]));
}

export async function getStickerIdToNumberMap(): Promise<Map<string, number>> {
  const stickers = await getStickerCatalog();
  return new Map(stickers.map((s) => [s.id, s.number]));
}
