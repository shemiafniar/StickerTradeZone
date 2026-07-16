import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Live-database proof that 0020_fix_existing_fwc_numbering.sql actually
 * does what it claims against a database in the *exact* state production
 * was confirmed to be in (0019 merged but never applied - see this
 * migration's own header comment for the root cause) - not just a static
 * check of the SQL text (see the sibling *.test.ts files for those).
 *
 * Requires a reachable local Postgres (matching this repo's existing
 * .github/workflows/database.yml convention: PGHOST/PGPORT/PGUSER/
 * PGPASSWORD env vars, defaulting to the same localhost/postgres/postgres
 * that workflow's `services: postgres` container exposes). Skips itself
 * entirely - rather than failing - when no such Postgres is reachable, so
 * `npm run test` still passes in a plain sandbox with no database at all.
 */

const migrationsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(migrationsDir, "..", "..");

const PG_HOST = process.env.PGHOST ?? "localhost";
const PG_PORT = Number(process.env.PGPORT ?? 5432);
const PG_USER = process.env.PGUSER ?? "postgres";
const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";
const TEST_DB = `fwc_migration_dbtest_${Date.now()}`;

async function adminClient(database = "postgres") {
  const client = new Client({ host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database });
  await client.connect();
  return client;
}

async function isDbAvailable(): Promise<boolean> {
  try {
    const client = await adminClient();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await isDbAvailable();

function readSql(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf-8");
}

const ADMIN_ID = "00000000-0000-0000-0000-0000000000a1";
const USER_ID = "00000000-0000-0000-0000-0000000000a2";
const TRADE_ID = "00000000-0000-0000-0000-0000000000a3";

describe.skipIf(!dbAvailable)("0020_fix_existing_fwc_numbering.sql - live database verification", () => {
  let client: Client;
  const idBefore: Record<string, string> = {};

  beforeAll(async () => {
    const admin = await adminClient();
    await admin.query(`create database ${TEST_DB}`);
    await admin.end();

    client = await adminClient(TEST_DB);
    await client.query(readSql("supabase/testing/auth_schema_stub.sql"));
    await client.query(readSql("supabase/testing/storage_schema_stub.sql"));

    // Apply every migration EXCEPT 0019 and 0020 - reproducing the exact
    // confirmed production state (0018 applied, 0019 never applied).
    const fs = await import("node:fs");
    const files = fs
      .readdirSync(join(repoRoot, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql") && !f.startsWith("0019") && !f.startsWith("0020"))
      .sort();
    for (const file of files) {
      await client.query(readSql(`supabase/migrations/${file}`));
    }

    // Create FWC exactly as the site administrator did, through the
    // pre-0019/0020 admin_add_team() - 1-20, no special case.
    await client.query(`insert into auth.users (id, email) values ('${ADMIN_ID}', 'admin@test.local')`);
    await client.query(
      `insert into public.profiles (id, full_name, role) values ('${ADMIN_ID}', 'Admin', 'admin') on conflict (id) do update set role = 'admin'`
    );
    await client.query(`insert into auth.users (id, email) values ('${USER_ID}', 'user@test.local')`);
    await client.query(
      `insert into public.profiles (id, full_name, role) values ('${USER_ID}', 'User', 'user') on conflict (id) do nothing`
    );
    await client.query(`set request.jwt.claim.sub = '${ADMIN_ID}'`);
    await client.query(`select public.admin_add_team('FWC', 'גביע העולם', '🏆')`);

    // Link real collection/trade data to FWC-1, FWC-10, and FWC-20 - the
    // exact rows that must survive the renumbering untouched by id.
    await client.query(
      `insert into public.user_stickers (user_id, sticker_id, quantity)
       select '${ADMIN_ID}', id, 3 from public.stickers where code = 'FWC-1'`
    );
    await client.query(
      `insert into public.user_stickers (user_id, sticker_id, quantity)
       select '${USER_ID}', id, 1 from public.stickers where code = 'FWC-20'`
    );
    await client.query(
      `insert into public.trade_requests (id, from_user_id, to_user_id, status)
       values ('${TRADE_ID}', '${ADMIN_ID}', '${USER_ID}', 'pending')`
    );
    await client.query(
      `insert into public.trade_request_items (trade_request_id, sticker_id, direction, quantity)
       select '${TRADE_ID}', id, 'give', 2 from public.stickers where code = 'FWC-10'`
    );

    const before = await client.query(
      `select id, code from public.stickers where team_code = 'FWC' and code in ('FWC-1', 'FWC-10', 'FWC-20')`
    );
    for (const row of before.rows) idBefore[row.code] = row.id;

    // Confirms the fixture actually reproduces the reported production bug
    // *before* touching 0020 at all.
    const preCheck = await client.query(
      `select min(number) as min, max(number) as max, count(*) as count from public.stickers where upper(team_code) = 'FWC'`
    );
    expect(Number(preCheck.rows[0].min)).toBe(1);
    expect(Number(preCheck.rows[0].max)).toBe(20);
    expect(Number(preCheck.rows[0].count)).toBe(20);

    // The actual fix under test.
    await client.query(readSql("supabase/migrations/0020_fix_existing_fwc_numbering.sql"));
  });

  afterAll(async () => {
    if (client) await client.end();
    const admin = await adminClient();
    await admin.query(`drop database if exists ${TEST_DB}`);
    await admin.end();
  });

  it("renumbers every FWC sticker to exactly 0-19 (the user's exact verification query)", async () => {
    const result = await client.query(
      `select id, team_code, number, code from stickers where upper(team_code) = 'FWC' order by number`
    );
    expect(result.rows).toHaveLength(20);
    expect(result.rows.map((r) => Number(r.number))).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("preserves every sticker id exactly (same 20 ids before and after)", async () => {
    const result = await client.query(`select id from public.stickers where team_code = 'FWC'`);
    expect(result.rows).toHaveLength(20);
    // Every id captured before the migration must still exist among FWC's
    // (now renumbered) rows - none were deleted/recreated.
    const idsAfter = new Set(result.rows.map((r) => r.id));
    for (const id of Object.values(idBefore)) {
      expect(idsAfter.has(id)).toBe(true);
    }
  });

  it("FWC code values match the corrected numbers (unpadded 'FWC-<number>')", async () => {
    const result = await client.query(`select number, code from public.stickers where team_code = 'FWC'`);
    for (const row of result.rows) {
      expect(row.code).toBe(`FWC-${row.number}`);
    }
  });

  it("the specific sticker that was FWC-1 (id preserved) is now FWC-0, with its user_stickers row still attached by the same id", async () => {
    const stickerId = idBefore["FWC-1"];
    const sticker = await client.query(`select code, number from public.stickers where id = $1`, [stickerId]);
    expect(sticker.rows[0]).toEqual({ code: "FWC-0", number: 0 });

    const link = await client.query(
      `select user_id, quantity from public.user_stickers where sticker_id = $1`,
      [stickerId]
    );
    expect(link.rows).toHaveLength(1);
    expect(link.rows[0]).toEqual({ user_id: ADMIN_ID, quantity: 3 });
  });

  it("the specific sticker that was FWC-20 (id preserved) is now FWC-19, with its user_stickers row still attached", async () => {
    const stickerId = idBefore["FWC-20"];
    const sticker = await client.query(`select code, number from public.stickers where id = $1`, [stickerId]);
    expect(sticker.rows[0]).toEqual({ code: "FWC-19", number: 19 });

    const link = await client.query(
      `select user_id, quantity from public.user_stickers where sticker_id = $1`,
      [stickerId]
    );
    expect(link.rows).toHaveLength(1);
    expect(link.rows[0]).toEqual({ user_id: USER_ID, quantity: 1 });
  });

  it("the specific sticker that was FWC-10 (id preserved) is now FWC-9, with its trade_request_items row still attached", async () => {
    const stickerId = idBefore["FWC-10"];
    const sticker = await client.query(`select code, number from public.stickers where id = $1`, [stickerId]);
    expect(sticker.rows[0]).toEqual({ code: "FWC-9", number: 9 });

    const link = await client.query(
      `select trade_request_id, quantity from public.trade_request_items where sticker_id = $1`,
      [stickerId]
    );
    expect(link.rows).toHaveLength(1);
    expect(link.rows[0]).toEqual({ trade_request_id: TRADE_ID, quantity: 2 });
  });

  it("leaves every ordinary team's numbering completely unchanged (still 1-20)", async () => {
    const result = await client.query(
      `select min(number) as min, max(number) as max, count(*) as count from public.stickers where team_code = 'GER'`
    );
    expect(Number(result.rows[0].min)).toBe(1);
    expect(Number(result.rows[0].max)).toBe(20);
    expect(Number(result.rows[0].count)).toBe(20);
  });

  it("enforces the new CHECK constraint (FWC-20 is now rejected, ordinary GER-21 was already and remains rejected)", async () => {
    await expect(
      client.query(`insert into public.stickers (team_code, number, code) values ('FWC', 20, 'FWC-20')`)
    ).rejects.toThrow(/stickers_number_range/);

    await expect(
      client.query(`insert into public.stickers (team_code, number, code) values ('GER', 21, 'GER-21')`)
    ).rejects.toThrow(/stickers_number_range/);
  });

  it("is idempotent - re-running the migration a second time leaves FWC at 0-19 with no error", async () => {
    await client.query(readSql("supabase/migrations/0020_fix_existing_fwc_numbering.sql"));
    const result = await client.query(
      `select min(number) as min, max(number) as max, count(*) as count from public.stickers where team_code = 'FWC'`
    );
    expect(Number(result.rows[0].min)).toBe(0);
    expect(Number(result.rows[0].max)).toBe(19);
    expect(Number(result.rows[0].count)).toBe(20);
  });

  it("a brand new FWC-like admin_add_team() call for a different custom team still gets the ordinary 1-20 range", async () => {
    await client.query(`set request.jwt.claim.sub = '${ADMIN_ID}'`);
    await client.query(`select public.admin_add_team('ZZZ', 'בדיקה', '🏳️')`);
    const result = await client.query(
      `select min(number) as min, max(number) as max, count(*) as count from public.stickers where team_code = 'ZZZ'`
    );
    expect(Number(result.rows[0].min)).toBe(1);
    expect(Number(result.rows[0].max)).toBe(20);
    expect(Number(result.rows[0].count)).toBe(20);
  });
});
