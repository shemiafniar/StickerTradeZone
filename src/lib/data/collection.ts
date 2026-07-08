import { createClient } from "@/lib/supabase/server";
import { getStickerIdToNumberMap } from "@/lib/data/stickers";
import type { UserDuplicate, UserMissing } from "@/types/database";

export interface DuplicateWithNumber extends UserDuplicate {
  number: number;
}

export interface MissingWithNumber extends UserMissing {
  number: number;
}

export async function getUserDuplicates(userId: string): Promise<DuplicateWithNumber[]> {
  const supabase = await createClient();
  const [{ data }, idToNumber] = await Promise.all([
    supabase.from("user_duplicates").select("*").eq("user_id", userId),
    getStickerIdToNumberMap(),
  ]);

  return ((data as UserDuplicate[]) ?? [])
    .map((d) => ({ ...d, number: idToNumber.get(d.sticker_id) ?? 0 }))
    .sort((a, b) => a.number - b.number);
}

export async function getUserMissing(userId: string): Promise<MissingWithNumber[]> {
  const supabase = await createClient();
  const [{ data }, idToNumber] = await Promise.all([
    supabase.from("user_missing").select("*").eq("user_id", userId),
    getStickerIdToNumberMap(),
  ]);

  return ((data as UserMissing[]) ?? [])
    .map((m) => ({ ...m, number: idToNumber.get(m.sticker_id) ?? 0 }))
    .sort((a, b) => a.number - b.number);
}

export async function getCollectionCounts(userId: string) {
  const supabase = await createClient();
  const [dup, missing] = await Promise.all([
    supabase.from("user_duplicates").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("user_missing").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  return {
    duplicates: dup.count ?? 0,
    missing: missing.count ?? 0,
  };
}
