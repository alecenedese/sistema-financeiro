import { NextRequest, NextResponse } from "next/server"
import { Client } from "pg"

// Versao 2 - forcando HMR reload
async function createPgClient() {
  const connStr = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
  const pgClient = new Client({ connectionString: connStr })
  await pgClient.connect()
  return pgClient
}

export async function GET(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    pgClient = await createPgClient()
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id')

    const sql = `
      SELECT 
        mr.id,
        mr.keyword,
        mr.categoria_id,
        mr.subcategoria_id,
        mr.subcategoria_filho_id,
        mr.fornecedor_id,
        mr.cliente_id,
        mr.cliente_fornecedor,
        mr.descricao,
        mr.substituir_descricao,
        mr.forma_pagamento,
        mr.tenant_id,
        c.nome as categoria_nome,
        s.nome as subcategoria_nome,
        sf.nome as filho_nome,
        f.nome as fornecedor_nome,
        cl.nome as cliente_nome
      FROM public.mapping_rules mr
      LEFT JOIN public.categorias c ON c.id = mr.categoria_id
      LEFT JOIN public.subcategorias s ON s.id = mr.subcategoria_id
      LEFT JOIN public.subcategorias_filhos sf ON sf.id = mr.subcategoria_filho_id
      LEFT JOIN public.fornecedores f ON f.id = mr.fornecedor_id
      LEFT JOIN public.clientes cl ON cl.id = mr.cliente_id
      ${tenantId ? 'WHERE mr.tenant_id = $1' : ''}
      ORDER BY mr.keyword
    `
    const params = tenantId ? [Number(tenantId)] : []
    const result = await pgClient.query(sql, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error("GET mapping-rules error:", e)
    return NextResponse.json([], { status: 200 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function POST(request: NextRequest) {
  let pgClient: Client | null = null
  const body = await request.json()
  const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body

  if (!keyword || !tenant_id) {
    return NextResponse.json({ error: "Keyword e tenant_id sao obrigatorios" }, { status: 400 })
  }

  try {
    pgClient = await createPgClient()
    await pgClient.query('BEGIN')

    try {
      if (id === 0 || !id) {
        const result = await pgClient.query(
          `INSERT INTO public.mapping_rules 
            (keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [keyword, categoria_id || null, subcategoria_id || null, subcategoria_filho_id || null, fornecedor_id || null, cliente_id || null, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', tenant_id]
        )
        await pgClient.query('COMMIT')
        return NextResponse.json({ success: true, data: result.rows[0] })
      } else {
        await pgClient.query(
          `UPDATE public.mapping_rules SET
            keyword = $1, categoria_id = $2, subcategoria_id = $3, subcategoria_filho_id = $4,
            fornecedor_id = $5, cliente_id = $6, cliente_fornecedor = $7,
            descricao = $8, substituir_descricao = $9, forma_pagamento = $10
           WHERE id = $11`,
          [keyword, categoria_id || null, subcategoria_id || null, subcategoria_filho_id || null, fornecedor_id || null, cliente_id || null, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', id]
        )
        await pgClient.query('COMMIT')
        return NextResponse.json({ success: true })
      }
    } catch (fkErr: unknown) {
      // Rollback e tenta sem os campos de referencia (FK violation)
      await pgClient.query('ROLLBACK')
      const pgErr = fkErr as { code?: string; detail?: string }
      if (pgErr.code === '23503') {
        await pgClient.query('BEGIN')
        if (id === 0 || !id) {
          const result = await pgClient.query(
            `INSERT INTO public.mapping_rules 
              (keyword, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [keyword, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', tenant_id]
          )
          await pgClient.query('COMMIT')
          return NextResponse.json({ success: true, data: result.rows[0] })
        } else {
          await pgClient.query(
            `UPDATE public.mapping_rules SET
              keyword = $1, cliente_fornecedor = $2,
              descricao = $3, substituir_descricao = $4, forma_pagamento = $5
             WHERE id = $6`,
            [keyword, cliente_fornecedor || '', descricao || '', substituir_descricao || false, forma_pagamento || '', id]
          )
          await pgClient.query('COMMIT')
          return NextResponse.json({ success: true })
        }
      }
      throw fkErr
    }
  } catch (error) {
    console.error("POST mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}

export async function DELETE(request: NextRequest) {
  let pgClient: Client | null = null
  try {
    pgClient = await createPgClient()
    const { searchParams } = new URL(request.url)
    const ruleId = searchParams.get('id')

    if (!ruleId) {
      return NextResponse.json({ error: "ID e obrigatorio" }, { status: 400 })
    }

    await pgClient.query('DELETE FROM public.mapping_rules WHERE id = $1', [Number(ruleId)])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  } finally {
    if (pgClient) await pgClient.end().catch(() => {})
  }
}
