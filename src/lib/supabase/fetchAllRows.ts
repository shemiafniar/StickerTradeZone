/**
 * Supabase enforces a hard server-side default of 1000 rows per request
 * (`db.max_rows` / PostgREST's default `max-rows`) - a query that matches
 * more rows than that is silently truncated to the first 1000, with NO
 * error surfaced to the client. Any query that needs *every* row across
 * an entire table (as opposed to one user's own rows via
 * `.eq("user_id", ...)`, which can never realistically exceed a user's
 * own ~960-sticker catalog) must page through with `.range()` instead of
 * a single `.select()`, or it will start silently dropping rows the
 * moment the table crosses that threshold - which for `user_stickers` is
 * just a modest number of active collectors (48 teams x 20 stickers means
 * a single fully-filled collection is already 960 rows on its own).
 *
 * This is exactly the kind of bug that looks like "a specific collector's
 * data disappeared from the admin view" even though nothing is wrong with
 * that collector's own rows or with the aggregation logic reading them -
 * the row was simply never fetched in the first place, because it landed
 * past whatever arbitrary (no explicit ORDER BY) cutoff point the 1000-row
 * cap happened to land on.
 */
const PAGE_SIZE = 1000;

interface PagedResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Pages through `queryFactory(from, to)` (a Supabase query with `.range()`
 * applied) until fewer than a full page comes back, accumulating every
 * row. Pass a function rather than a single query object because
 * Supabase's query builders are single-use once awaited.
 */
export async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<PagedResult<T>>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryFactory(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("[fetchAllRows] Paginated query failed:", error.message);
      break;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
