import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";

function makeSourceRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `row-${i}` }));
}

describe("fetchAllRows", () => {
  it("returns everything in a single page when the table has fewer than 1000 rows", async () => {
    const source = makeSourceRows(42);
    const queryFactory = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchAllRows(queryFactory);

    expect(result).toHaveLength(42);
    expect(queryFactory).toHaveBeenCalledTimes(1);
    expect(queryFactory).toHaveBeenCalledWith(0, 999);
  });

  it("pages through a table with exactly 1000 rows (the default cap) without an extra empty request", async () => {
    const source = makeSourceRows(1000);
    const queryFactory = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchAllRows(queryFactory);

    // A page of exactly 1000 rows *looks* like it might be truncated, so a
    // second page is fetched to confirm - that second page comes back
    // empty, terminating the loop without duplicating any rows.
    expect(result).toHaveLength(1000);
    expect(queryFactory).toHaveBeenCalledTimes(2);
  });

  it("pages through a table with more than 1000 rows - this is the exact scenario that silently dropped rows before this fix", async () => {
    const source = makeSourceRows(2500);
    const queryFactory = vi.fn(async (from: number, to: number) => ({
      data: source.slice(from, to + 1),
      error: null,
    }));

    const result = await fetchAllRows(queryFactory);

    expect(result).toHaveLength(2500);
    expect(result[0]).toEqual({ id: "row-0" });
    expect(result[2499]).toEqual({ id: "row-2499" });
    expect(queryFactory).toHaveBeenCalledTimes(3); // 1000 + 1000 + 500
  });

  it("stops and returns whatever was accumulated so far if a page errors, without throwing", async () => {
    const source = makeSourceRows(1500);
    const queryFactory = vi.fn(async (from: number, to: number) => {
      if (from > 0) return { data: null, error: { message: "connection reset" } };
      return { data: source.slice(from, to + 1), error: null };
    });

    const result = await fetchAllRows(queryFactory);

    expect(result).toHaveLength(1000); // first page succeeded, second failed
  });

  it("returns an empty array for an empty table", async () => {
    const queryFactory = vi.fn(async () => ({ data: [], error: null }));
    const result = await fetchAllRows(queryFactory);
    expect(result).toEqual([]);
  });

  it("treats a null data page the same as an empty page", async () => {
    const queryFactory = vi.fn(async () => ({ data: null, error: null }));
    const result = await fetchAllRows(queryFactory);
    expect(result).toEqual([]);
  });
});
