import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static checks on this migration's SQL text - guards against a future
 * edit accidentally breaking the idempotency guard, the FWC-specific
 * constraint, or admin_add_team()'s FWC special-case, without needing a
 * live Postgres instance (see .github/workflows/database.yml for the full
 * migration-application test, which does use a real database - and this
 * migration was additionally verified by hand against a simulated
 * drifted/legacy production database with existing FWC user_stickers and
 * trade_request_items rows, confirming ids are preserved and both kinds of
 * linked records keep resolving correctly after the renumbering).
 */
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "0019_fwc_numbering.sql");
const sql = readFileSync(migrationPath, "utf-8");

describe("0019_fwc_numbering.sql", () => {
  it("only renumbers rows where team_code = 'FWC', never touching any other team", () => {
    expect(sql).toMatch(/where\s+team_code\s*=\s*'FWC'/i);
  });

  it("shifts the number down by exactly 1 and rebuilds the unpadded 'FWC-<number>' code, matching the project's existing code convention", () => {
    expect(sql).toMatch(/number\s*=\s*number\s*-\s*1/);
    expect(sql).toMatch(/'FWC-'\s*\|\|\s*\(number\s*-\s*1\)/);
  });

  it("guards the one-time shift behind an idempotency check (only when a not-yet-renumbered FWC-20 still exists)", () => {
    expect(sql).toMatch(/exists\s*\(select 1 from public\.stickers where team_code = 'FWC' and number = 20\)/i);
  });

  it("installs a permanent CHECK constraint allowing FWC 0-19 and every other team 1-20", () => {
    expect(sql).toContain("stickers_number_range");
    expect(sql).toMatch(/team_code\s*=\s*'FWC'\s+and\s+number\s+between\s+0\s+and\s+19/i);
    expect(sql).toMatch(/team_code\s*<>\s*'FWC'\s+and\s+number\s+between\s+1\s+and\s+20/i);
  });

  it("redefines admin_add_team() so FWC gets generate_series(0, 19) while every other team keeps 1-20", () => {
    expect(sql).toMatch(/create or replace function public\.admin_add_team/);
    expect(sql).toMatch(/if v_code = 'FWC' then\s*\n\s*v_start := 0;\s*\n\s*v_end := 19;/);
    expect(sql).toMatch(/generate_series\(v_start, v_end\)/);
  });

  it("preserves the on conflict guard on the sticker insert (never re-creates a sticker row, only inserts genuinely missing ones)", () => {
    expect(sql).toMatch(/on conflict \(team_code, number\) do nothing/);
  });
});
