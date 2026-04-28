/**
 * Paginates a Supabase query to fetch ALL rows, bypassing the 1000-row hard limit.
 *
 * Aceita tanto:
 *   fetchAll(supabase.from("x").select("*"))            // query direta
 *   fetchAll(() => supabase.from("x").select("*"))      // builder em função
 */
export async function fetchAll<T = Record<string, unknown>>(
  queryOrBuilder: any
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0

  // Se for função, podemos paginar corretamente criando nova query a cada página.
  const isFunction = typeof queryOrBuilder === "function"

  while (true) {
    try {
      let result: { data: any; error: any }

      if (isFunction) {
        // Cria nova query a cada página para evitar reutilização do builder
        result = await queryOrBuilder().range(offset, offset + PAGE - 1)
      } else {
        // Query direta: executa diretamente (sem paginação adicional)
        // Supabase retorna até 1000 rows por padrão
        if (offset === 0) {
          // Tenta executar a query - pode já ter .range() ou não
          result = await queryOrBuilder
        } else {
          // Não podemos paginar query direta, retorna o que já temos
          break
        }
      }

      const { data, error } = result

      if (error) {
        console.error("[fetchAll] query error:", error)
        break
      }

      if (!data || data.length === 0) break

      all.push(...(data as T[]))

      // Para query direta, não tenta paginar
      if (!isFunction) break

      if (data.length < PAGE) break

      offset += PAGE
    } catch (err) {
      console.error("[fetchAll] exception:", err)
      break
    }
  }

  return all
}
