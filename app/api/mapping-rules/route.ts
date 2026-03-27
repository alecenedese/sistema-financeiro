import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL?.includes('sslmode=')
    ? undefined
    : { rejectUnauthorized: false },
})

// Workaround para certificados Supabase em ambientes Node.js restritivos
if (typeof process !== 'undefined') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const tenantId = searchParams.get('tenant_id')

    if (id) {
      const result = await pool.query(
        `SELECT mr.*, 
          c.nome as categoria_nome, s.nome as subcategoria_nome, 
          sf.nome as filho_nome, f.nome as fornecedor_nome, cl.nome as cliente_nome
        FROM mapping_rules mr
        LEFT JOIN categorias c ON c.id = mr.categoria_id
        LEFT JOIN subcategorias s ON s.id = mr.subcategoria_id
        LEFT JOIN subcategorias_filhos sf ON sf.id = mr.subcategoria_filho_id
        LEFT JOIN fornecedores f ON f.id = mr.fornecedor_id
        LEFT JOIN clientes cl ON cl.id = mr.cliente_id
        WHERE mr.id = $1`,
        [Number(id)]
      )
      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Regra nao encontrada" }, { status: 404 })
      }
      return NextResponse.json(result.rows[0])
    }

    // Lista todas as regras (com tenant filter opcional)
    let query = `SELECT mr.*, 
      c.nome as categoria_nome, s.nome as subcategoria_nome, 
      sf.nome as filho_nome, f.nome as fornecedor_nome, cl.nome as cliente_nome
    FROM mapping_rules mr
    LEFT JOIN categorias c ON c.id = mr.categoria_id
    LEFT JOIN subcategorias s ON s.id = mr.subcategoria_id
    LEFT JOIN subcategorias_filhos sf ON sf.id = mr.subcategoria_filho_id
    LEFT JOIN fornecedores f ON f.id = mr.fornecedor_id
    LEFT JOIN clientes cl ON cl.id = mr.cliente_id`
    const params: unknown[] = []

    if (tenantId) {
      query += ` WHERE mr.tenant_id = $1`
      params.push(Number(tenantId))
    }

    query += ` ORDER BY mr.keyword`

    const result = await pool.query(query, params)
    return NextResponse.json(result.rows)
  } catch (e) {
    console.error("GET mapping-rules error:", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, keyword, categoria_id, subcategoria_id, subcategoria_filho_id, fornecedor_id, cliente_id, cliente_fornecedor, descricao, substituir_descricao, forma_pagamento, tenant_id } = body

    if (!keyword || !tenant_id) {
      return NextResponse.json({ error: "Keyword e tenant_id sao obrigatorios" }, { status: 400 })
    }

    if (!id || id === 0) {
      // Insert
      const result = await pool.query(
        `INSERT INTO mapping_rules (
          keyword, categoria_id, subcategoria_id, subcategoria_filho_id,
          fornecedor_id, cliente_id, cliente_fornecedor,
          descricao, substituir_descricao, forma_pagamento, tenant_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          keyword,
          categoria_id || null,
          subcategoria_id || null,
          subcategoria_filho_id || null,
          fornecedor_id || null,
          cliente_id || null,
          cliente_fornecedor || '',
          descricao || '',
          substituir_descricao || false,
          forma_pagamento || '',
          tenant_id,
        ]
      )
      return NextResponse.json({ success: true, data: { id: result.rows[0].id } })
    } else {
      // Update
      await pool.query(
        `UPDATE mapping_rules SET
          keyword = $1, categoria_id = $2, subcategoria_id = $3, subcategoria_filho_id = $4,
          fornecedor_id = $5, cliente_id = $6, cliente_fornecedor = $7,
          descricao = $8, substituir_descricao = $9, forma_pagamento = $10
        WHERE id = $11`,
        [
          keyword,
          categoria_id || null,
          subcategoria_id || null,
          subcategoria_filho_id || null,
          fornecedor_id || null,
          cliente_id || null,
          cliente_fornecedor || '',
          descricao || '',
          substituir_descricao || false,
          forma_pagamento || '',
          id,
        ]
      )
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error("POST mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "ID e obrigatorio" }, { status: 400 })
    }

    await pool.query(`DELETE FROM mapping_rules WHERE id = $1`, [Number(id)])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE mapping-rules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
