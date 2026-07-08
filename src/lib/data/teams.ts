import { createClient } from "@/lib/supabase/server";
import type { Sticker, Team } from "@/types/database";

export async function getTeams(): Promise<Team[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("teams").select("*").order("sort_order", { ascending: true });
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
