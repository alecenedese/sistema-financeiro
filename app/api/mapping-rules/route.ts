import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { id, ...ruleData } = body
    
    if (id === 0) {
      // New rule
      const { error } = await supabase.from("mapping_rules").insert(ruleData)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    } else {
      // Update existing
      const { error } = await supabase.from("mapping_rules").update(ruleData).eq("id", id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving rule:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
