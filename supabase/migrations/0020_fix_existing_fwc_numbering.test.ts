import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static checks on this corrective migration's SQL text - see the sibling
 * 0020_fix_existing_fwc_numbering.dbtest.test.ts for the live-database
 * proof of the actual runtime behavior (same 20 ids before/after, linked
 * user_stickers/trade_request_items rows staying attached, FWC ending up
 * at 0-19, ordinary teams unchanged) - this file only guards against a
 * future edit accidentally breaking one of the textual invariants below
 * without needing a live Postgres instance.
 */
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "0020_fix_existing_fwc_numbering.sql");
const sql = readFileSync(migrationPath, "utf-8");

describe("0020_fix_existing_fwc_numbering.sql", () => {
  it("identifies FWC rows case-insensitively via upper(team_code), matching the exact diagnostic query that confirmed the bug", () => {
    expect(sql).toMatch(/upper\(team_code\)\s*=\s*'FWC'/i);
  });

  it("shifts the number down by exactly 1 and rebuilds the unpadded 'FWC-<number>' code", () => {
    expect(sql).toMatch(/number\s*=\s*number\s*-\s*1/);
    expect(sql).toMatch(/'FWC-'\s*\|\|\s*\(number\s*-\s*1\)/);
  });

  it("guards the one-time shift behind an idempotency check (only when an unshifted FWC-20 still exists)", () => {
    expect(sql).toMatch(/exists\s*\(\s*select 1 from public\.stickers where upper\(team_code\) = 'FWC' and number = 20/i);
  });

  it("drops and recreates the unique constraints around the shift, to avoid any mid-update collision", () => {
    expect(sql).toMatch(/drop constraint if exists stickers_team_number_key/);
    expect(sql).toMatch(/drop constraint if exists stickers_code_key/);
    expect(sql).toMatch(/add constraint stickers_team_number_key unique \(team_code, number\)/);
    expect(sql).toMatch(/add constraint stickers_code_key unique \(code\)/);
  });

  it("installs a permanent CHECK constraint allowing FWC 0-19 and every other team 1-20, unconditionally (not only inside the idempotency-guarded block)", () => {
    expect(sql).toContain("stickers_number_range");
    expect(sql).toMatch(/team_code\s*=\s*'FWC'\s+and\s+number\s+between\s+0\s+and\s+19/i);
    expect(sql).toMatch(/team_code\s*<>\s*'FWC'\s+and\s+number\s+between\s+1\s+and\s+20/i);
  });

  it("redefines admin_add_team() so FWC gets generate_series(0, 19) while every other team keeps 1-20", () => {
    expect(sql).toMatch(/create or replace function public\.admin_add_team/);
    expect(sql).toMatch(/if v_code = 'FWC' then\s*\n\s*v_start := 0;\s*\n\s*v_end := 19;/);
    expect(sql).toMatch(/generate_series\(v_start, v_end\)/);
  });

  it("never contains an ALTER/DROP statement targeting 0019_fwc_numbering.sql itself - this is a new, independent file, not an edit of an already-merged migration", () => {
    expect(sql).not.toMatch(/alter\s+(the\s+)?(file\s+)?0019|drop\s+.*0019|rename\s+.*0019/i);
  });
});
