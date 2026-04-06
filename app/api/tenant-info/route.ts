import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get("tenantId")

  if (!tenantId) {
    return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    
    console.log("[v0] API tenant-info - tenantId:", tenantId)
    
    // Usa maybeSingle() para não dar erro se não encontrar
    const { data, error } = await supabase
      .from("tenant_clientes")
      .select("id, nome")
      .eq("id", tenantId)
      .maybeSingle()

    console.log("[v0] API tenant-info - data:", data, "error:", error)

    if (error) {
      console.error("[v0] API tenant-info error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, nome: data.nome || "" })
  } catch (error) {
    console.error("[v0] API tenant-info error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
