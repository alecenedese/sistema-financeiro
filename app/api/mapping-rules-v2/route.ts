import { NextRequest, NextResponse } from "next/server"
import { Client } from "pg"

async function createPgClient() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  })
  await client.connect()
  return client
}

// GET: Retorna descricao, substituir_descricao e forma_pagamento de todas as regras do tenant
export async function GET(request: NextRequest) {
  let pgClient: Client | null = null
  const { searchParams } = new URL(request.url)
  const tenant_id = searchParams.get("tenant_id")

  try {
    pgClient = await createPgClient()
    const result = await pgClient.query(
      `SELECT id, descricao, substituir_descricao, forma_pagamento FROM public.mapping_rules WHERE tenant_id = $1`,
      [tenant_id]
    )
    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("GET mapping-rules-v2 error:", error)
    return NextResponse.json({ error: "Erro ao buscar" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

// POST: Atualiza APENAS descricao, substituir_descricao e forma_pagamento
// Os outros campos são salvos via Supabase client no frontend
export async function POST(request: NextRequest) {
  let pgClient: Client | null = null
  const body = await request.json()
  const { id, descricao, substituir_descricao, forma_pagamento } = body

  if (!id) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 })
  }

  try {
    pgClient = await createPgClient()

    await pgClient.query(
      `UPDATE public.mapping_rules SET
        descricao = $1,
        substituir_descricao = $2,
        forma_pagamento = $3
       WHERE id = $4`,
      [descricao || "", substituir_descricao || false, forma_pagamento || "", id]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST mapping-rules-v2 error:", error)
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}
