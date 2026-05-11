/**
 * Paginates a Supabase query to fetch ALL rows, bypassing the 1000-row hard limit.
 *
 * Aceita:
 *   fetchAll(supabase.from("x").select("*").eq(...))   // query direta (paginada via .range)
 *   fetchAll(() => supabase.from("x").select("*"))     // builder em função (paginado por nova query)
 */
export async function fetchAll<T = Record<string, unknown>>(
  queryOrBuilder: any
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0

  const isFunction = typeof queryOrBuilder === "function"

  while (true) {
    try {
      let result: { data: any; error: any }

      if (isFunction) {
        result = await queryOrBuilder().range(offset, offset + PAGE - 1)
      } else {
        // Query direta: aplica .range() para forçar paginação real
        result = await queryOrBuilder.range(offset, offset + PAGE - 1)
      }

      const { data, error } = result

      if (error) {
        console.error("[fetchAll] query error:", error)
        break
      }

      if (!data || data.length === 0) break

      all.push(...(data as T[]))

      if (data.length < PAGE) break

      offset += PAGE
    } catch (err) {
      console.error("[fetchAll] exception:", err)
      break
    }
  }

  return all
}
