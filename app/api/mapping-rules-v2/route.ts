import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Cria Supabase Admin client com service role (bypassa RLS)
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log("[v0] API mapping-rules-v2 - supabaseUrl:", supabaseUrl ? "SET" : "MISSING")
  console.log("[v0] API mapping-rules-v2 - serviceRoleKey:", serviceRoleKey ? `SET (length: ${serviceRoleKey.length})` : "MISSING")
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`Missing Supabase credentials: url=${!!supabaseUrl}, key=${!!serviceRoleKey}`)
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })
}

// GET: Retorna descricao de todas as regras do tenant
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenant_id = searchParams.get("tenant_id")

  try {
    const supabase = createAdminClient()
    
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
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { id, descricao, substituir_descricao, forma_pagamento } = body

  console.log("[v0] POST mapping-rules-v2 - id:", id, "descricao:", descricao)

  if (!id || Number(id) <= 0) {
    return NextResponse.json({ success: true, skipped: true })
  }

  try {
    const supabase = createAdminClient()

    const { error } = await supabase
      .from("mapping_rules")
      .update({
        descricao: descricao || "",
        substituir_descricao: substituir_descricao || false,
        forma_pagamento: forma_pagamento || ""
      })
      .eq("id", Number(id))

    console.log("[v0] POST mapping-rules-v2 - update error:", error)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST mapping-rules-v2 error:", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
