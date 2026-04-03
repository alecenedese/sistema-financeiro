import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Cria Supabase Admin client com service role (bypassa RLS e usa conexão direta)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })
}

// GET: Retorna descricao, substituir_descricao e forma_pagamento de todas as regras do tenant
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenant_id = searchParams.get("tenant_id")

  try {
    const supabase = createAdminClient()
    
    // Usa SQL raw via rpc para buscar os campos específicos
    const { data, error } = await supabase
      .from("mapping_rules")
      .select("id, descricao, substituir_descricao, forma_pagamento")
      .eq("tenant_id", Number(tenant_id))

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("GET mapping-rules-v2 error:", error)
    return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 })
  }
}

// POST: Atualiza APENAS descricao, substituir_descricao e forma_pagamento
// Os outros campos são salvos via Supabase client no frontend
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, descricao, substituir_descricao, forma_pagamento } = body

  // Se id não for válido, retorna sucesso sem fazer nada
  if (!id || Number(id) <= 0) {
    return NextResponse.json({ success: true, skipped: true })
  }

  try {
    const supabase = createAdminClient()

    // UPDATE via Supabase Admin (bypassa cache do PostgREST normal)
    const { error } = await supabase
      .from("mapping_rules")
      .update({
        descricao: descricao || "",
        substituir_descricao: substituir_descricao || false,
        forma_pagamento: forma_pagamento || ""
      })
      .eq("id", Number(id))

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST mapping-rules-v2 error:", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
