import { createClient } from "@/lib/supabase/server";
import type { Sticker, Team } from "@/types/database";

/**
 * Teams in official World Cup 2026 group order (Group A first, then B, C,
 * ... through L; official position within each group) - `group_order`/
 * `team_order` are the explicit, stable sort fields for this (see
 * migration 0017_quantity_and_groups.sql), never Hebrew/English name or
 * insertion order. A custom team an admin adds beyond the official 48
 * defaults to group_order = 99, so it always sorts after every real group.
 * This is the single query every team-listing surface in the app uses -
 * keep it that way rather than re-ordering ad hoc at a call site.
 */
export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("group_order", { ascending: true })
    .order("team_order", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data as Team[]) ?? [];
}

export async function getTeamByCode(code: string): Promise<Team | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*").eq("code", code.toUpperCase()).maybeSingle();
  return (data as Team | null) ?? null;
}

export async function getStickersForTeam(teamCode: string): Promise<Sticker[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stickers")
    .select("*")
    .eq("team_code", teamCode.toUpperCase())
    .order("number", { ascending: true });
  return (data as Sticker[]) ?? [];
}
