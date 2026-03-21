import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── Rate limiter in-memory ────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string, maxRequests = 3, windowMs = 3600000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) return false
  entry.count++
  return true
}

// ─── Validation ────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── POST /api/leads/demo ──────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown'

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
        { status: 429 }
      )
    }

    // Parse body
    const body = await request.json()
    const { nombre, correo, empresa, telefono, giro } = body

    // Validate required fields
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'El nombre es requerido.' },
        { status: 400 }
      )
    }

    if (!correo || typeof correo !== 'string' || !EMAIL_REGEX.test(correo.trim())) {
      return NextResponse.json(
        { success: false, error: 'Un correo electronico valido es requerido.' },
        { status: 400 }
      )
    }

    // Insert lead
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase
      .schema('erp')
      .from('leads_demo')
      .insert({
        nombre: nombre.trim().slice(0, 200),
        correo: correo.trim().toLowerCase().slice(0, 200),
        empresa: empresa?.trim()?.slice(0, 200) || null,
        telefono: telefono?.trim()?.slice(0, 20) || null,
        giro: giro?.trim()?.slice(0, 100) || null,
        ip_address: ip !== 'unknown' ? ip : null,
      })

    if (error) {
      console.error('[leads/demo] Insert error:', error)
      return NextResponse.json(
        { success: false, error: 'Error al guardar tu solicitud. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[leads/demo] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor.' },
      { status: 500 }
    )
  }
}
