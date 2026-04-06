import { createClient } from "@/lib/supabase/client"

// Salva descricao usando a VIEW que bypassa o cache do PostgREST
export async function saveDescricaoViaView(
  id: number,
  descricao: string,
  substituir_descricao: boolean,
  forma_pagamento: string
) {
  const supabase = createClient()
  
  console.log("[v0] saveDescricaoViaView - id:", id, "descricao:", descricao)
  
  const { error } = await supabase
    .from("mapping_rules_view")
    .update({
      descricao: descricao || "",
      substituir_descricao: substituir_descricao || false,
      forma_pagamento: forma_pagamento || "",
    })
    .eq("id", id)

  console.log("[v0] saveDescricaoViaView - error:", error)
  
  return { error }
}

// Busca descricao usando a VIEW
export async function fetchDescricaoViaView(tenantId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("mapping_rules_view")
    .select("id, descricao, substituir_descricao, forma_pagamento")
    .eq("tenant_id", tenantId)

  console.log("[v0] fetchDescricaoViaView - count:", data?.length, "error:", error)
  
  return { data, error }
}
