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
    const { data, error } = await supabase
      .from("tenant_clientes")
      .select("id, nome")
      .eq("id", tenantId)
      .single()

    if (error) {
      console.error("[v0] API tenant-info error:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, nome: data?.nome || "" })
  } catch (error) {
    console.error("[v0] API tenant-info error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
