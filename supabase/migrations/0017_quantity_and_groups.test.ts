import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static data-integrity checks on the World Cup group assignment table
 * embedded in this migration - guards against a future edit accidentally
 * duplicating/dropping a team or breaking a group's size, without needing
 * a live Postgres instance (see .github/workflows/database.yml for the
 * full migration-application test, which does use a real database).
 */
const migrationPath = join(dirname(fileURLToPath(import.meta.url)), "0017_quantity_and_groups.sql");
const sql = readFileSync(migrationPath, "utf-8");

interface GroupRow {
  code: string;
  group: string;
  groupOrder: number;
  teamOrder: number;
}

function parseGroupRows(source: string): GroupRow[] {
  const rowPattern = /\('([A-Z]{3})',\s*'([A-L])',\s*(\d+),\s*(\d+)\)/g;
  const rows: GroupRow[] = [];
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(source)) !== null) {
    rows.push({ code: match[1], group: match[2], groupOrder: Number(match[3]), teamOrder: Number(match[4]) });
  }
  return rows;
}

describe("0017_quantity_and_groups.sql team group data", () => {
  const rows = parseGroupRows(sql);

  it("parses exactly 48 team rows from the migration", () => {
    expect(rows).toHaveLength(48);
  });

  it("has no duplicate team codes", () => {
    const codes = rows.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("covers every group A through L, with exactly 4 teams each", () => {
    const groups = "ABCDEFGHIJKL".split("");
    for (const group of groups) {
      const teamsInGroup = rows.filter((r) => r.group === group);
      expect(teamsInGroup, `group ${group}`).toHaveLength(4);
    }
  });

  it("assigns group_order 1-12 matching group letter A-L in order", () => {
    for (const row of rows) {
      const expectedOrder = row.group.charCodeAt(0) - "A".charCodeAt(0) + 1;
      expect(row.groupOrder, `${row.code} in group ${row.group}`).toBe(expectedOrder);
    }
  });

  it("assigns team_order 1-4 uniquely within each group", () => {
    const groups = "ABCDEFGHIJKL".split("");
    for (const group of groups) {
      const teamOrders = rows.filter((r) => r.group === group).map((r) => r.teamOrder);
      expect(new Set(teamOrders)).toEqual(new Set([1, 2, 3, 4]));
    }
  });

  it("includes the three World Cup 2026 host nations in their known groups (A, B, D)", () => {
    const byCode = new Map(rows.map((r) => [r.code, r]));
    expect(byCode.get("MEX")?.group).toBe("A");
    expect(byCode.get("CAN")?.group).toBe("B");
    expect(byCode.get("USA")?.group).toBe("D");
  });
});
