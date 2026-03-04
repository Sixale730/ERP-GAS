import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getBanxicoConfig, isBanxicoConfigured } from '@/lib/config/banxico'

interface TipoCambioResponse {
  ok: boolean
  tipo_cambio: number
  fecha: string
  fuente: string
  cached: boolean
  mensaje?: string
  vigente_desde?: string | null
  vigente_hasta?: string | null
}

const FALLBACK_RATE = 17.50

function computeVigencia(): { vigente_desde: string; vigente_hasta: string } {
  // TC published today (day X) applies tomorrow (X+1) through day after (X+2)
  const now = new Date()
  const mx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
  const desde = new Date(mx)
  desde.setDate(desde.getDate() + 1)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(mx)
  hasta.setDate(hasta.getDate() + 2)
  hasta.setHours(0, 0, 0, 0)
  return { vigente_desde: desde.toISOString(), vigente_hasta: hasta.toISOString() }
}

function todayMexico(): string {
  const now = new Date()
  const mx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
  return mx.toISOString().split('T')[0]
}

function hourMexico(): number {
  const now = new Date()
  const mx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }))
  return mx.getHours()
}

async function getConfiguracionRate(supabase: any): Promise<number | null> {
  try {
    const { data } = await supabase
      .schema('erp')
      .from('configuracion')
      .select('valor')
      .eq('clave', 'tipo_cambio')
      .single()
    return data?.valor?.valor ?? null
  } catch {
    return null
  }
}

async function getLastKnownRate(supabase: any): Promise<{ valor: number; fecha: string; vigente_desde: string | null; vigente_hasta: string | null } | null> {
  try {
    const { data } = await supabase
      .schema('erp')
      .from('tipo_cambio_diario')
      .select('valor, fecha, vigente_desde, vigente_hasta')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    return data ? { valor: Number(data.valor), fecha: data.fecha, vigente_desde: data.vigente_desde, vigente_hasta: data.vigente_hasta } : null
  } catch {
    return null
  }
}

async function getEffectiveRate(supabase: any): Promise<{ valor: number; fecha: string; fuente: string; vigente_desde: string | null; vigente_hasta: string | null } | null> {
  try {
    const nowUtc = new Date().toISOString()
    const { data } = await supabase
      .schema('erp')
      .from('tipo_cambio_diario')
      .select('valor, fecha, fuente, vigente_desde, vigente_hasta')
      .lte('vigente_desde', nowUtc)
      .gt('vigente_hasta', nowUtc)
      .limit(1)
      .single()
    return data ? { valor: Number(data.valor), fecha: data.fecha, fuente: data.fuente, vigente_desde: data.vigente_desde, vigente_hasta: data.vigente_hasta } : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { ok: false, tipo_cambio: FALLBACK_RATE, fecha: todayMexico(), fuente: 'fallback', cached: false, mensaje: 'No autenticado' },
        { status: 200 }
      )
    }

    const force = request.nextUrl.searchParams.get('force') === 'true'
    const fechaHoy = todayMexico()

    // Check for currently effective rate (vigente_desde <= now < vigente_hasta)
    if (!force) {
      const effective = await getEffectiveRate(supabase)
      if (effective) {
        return NextResponse.json({
          ok: true,
          tipo_cambio: effective.valor,
          fecha: effective.fecha,
          fuente: effective.fuente,
          cached: true,
          vigente_desde: effective.vigente_desde,
          vigente_hasta: effective.vigente_hasta,
        } satisfies TipoCambioResponse)
      }
    }

    // Before 12 PM Mexico City, Banxico may not have published today's rate
    if (hourMexico() < 12 && !force) {
      const last = await getLastKnownRate(supabase)
      const configRate = await getConfiguracionRate(supabase)
      const rate = last?.valor ?? configRate ?? FALLBACK_RATE
      const fecha = last?.fecha ?? fechaHoy

      return NextResponse.json({
        ok: true,
        tipo_cambio: rate,
        fecha,
        fuente: 'cache',
        cached: true,
        mensaje: 'El tipo de cambio FIX se publica despues de las 12:00 PM. Mostrando ultimo valor conocido.',
        vigente_desde: last?.vigente_desde ?? null,
        vigente_hasta: last?.vigente_hasta ?? null,
      } satisfies TipoCambioResponse)
    }

    // Check if Banxico is configured
    if (!isBanxicoConfigured()) {
      const configRate = await getConfiguracionRate(supabase)
      const last = await getLastKnownRate(supabase)
      const rate = configRate ?? last?.valor ?? FALLBACK_RATE

      return NextResponse.json({
        ok: true,
        tipo_cambio: rate,
        fecha: fechaHoy,
        fuente: 'configuracion',
        cached: true,
        mensaje: 'Token de Banxico no configurado. Usando valor de configuracion.',
        vigente_desde: last?.vigente_desde ?? null,
        vigente_hasta: last?.vigente_hasta ?? null,
      } satisfies TipoCambioResponse)
    }

    // Fetch from Banxico API
    const config = getBanxicoConfig()
    const url = `${config.baseUrl}/${config.serieFix}/datos/oportuno`

    let banxicoData: any
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, {
        headers: { 'Bmx-Token': config.token },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Banxico API responded with ${response.status}`)
      }

      banxicoData = await response.json()
    } catch (fetchError) {
      console.error('Error fetching Banxico API:', fetchError)
      const configRate = await getConfiguracionRate(supabase)
      const last = await getLastKnownRate(supabase)
      const rate = configRate ?? last?.valor ?? FALLBACK_RATE

      return NextResponse.json({
        ok: true,
        tipo_cambio: rate,
        fecha: fechaHoy,
        fuente: 'configuracion',
        cached: true,
        mensaje: 'No se pudo conectar con Banxico. Usando valor de configuracion.',
        vigente_desde: last?.vigente_desde ?? null,
        vigente_hasta: last?.vigente_hasta ?? null,
      } satisfies TipoCambioResponse)
    }

    // Parse Banxico response
    const series = banxicoData?.bmx?.series?.[0]
    const dato = series?.datos?.[0]
    const valorStr = dato?.dato

    if (!valorStr || valorStr === 'N/E') {
      // N/E = Not available (weekends/holidays)
      const last = await getLastKnownRate(supabase)
      const configRate = await getConfiguracionRate(supabase)
      const rate = last?.valor ?? configRate ?? FALLBACK_RATE
      const fecha = last?.fecha ?? fechaHoy

      return NextResponse.json({
        ok: true,
        tipo_cambio: rate,
        fecha,
        fuente: 'cache',
        cached: true,
        mensaje: 'Dato no disponible en Banxico (fin de semana o dia festivo). Mostrando ultimo valor conocido.',
        vigente_desde: last?.vigente_desde ?? null,
        vigente_hasta: last?.vigente_hasta ?? null,
      } satisfies TipoCambioResponse)
    }

    const valor = parseFloat(valorStr.replace(',', ''))
    if (isNaN(valor)) {
      const configRate = await getConfiguracionRate(supabase)
      return NextResponse.json({
        ok: true,
        tipo_cambio: configRate ?? FALLBACK_RATE,
        fecha: fechaHoy,
        fuente: 'configuracion',
        cached: true,
        mensaje: 'Respuesta de Banxico malformada. Usando valor de configuracion.',
      } satisfies TipoCambioResponse)
    }

    // Save to tipo_cambio_diario (upsert)
    try {
      await supabase
        .schema('erp')
        .from('tipo_cambio_diario')
        .upsert(
          { fecha: fechaHoy, valor, fuente: 'banxico', serie: config.serieFix, ...computeVigencia() },
          { onConflict: 'fecha' }
        )
    } catch (dbError) {
      console.error('Error saving tipo_cambio_diario:', dbError)
    }

    // Dual-write to configuracion
    try {
      await supabase
        .schema('erp')
        .from('configuracion')
        .update({ valor: { valor, fecha: fechaHoy } })
        .eq('clave', 'tipo_cambio')
    } catch (dbError) {
      console.error('Error updating configuracion:', dbError)
    }

    // Return the effective rate for today (not the just-fetched one which applies tomorrow)
    const effective = await getEffectiveRate(supabase)
    if (effective) {
      return NextResponse.json({
        ok: true,
        tipo_cambio: effective.valor,
        fecha: effective.fecha,
        fuente: effective.fuente,
        cached: false,
        vigente_desde: effective.vigente_desde,
        vigente_hasta: effective.vigente_hasta,
      } satisfies TipoCambioResponse)
    }

    // Fallback: no effective rate yet (first time), return the just-fetched one
    const vigencia = computeVigencia()
    return NextResponse.json({
      ok: true,
      tipo_cambio: valor,
      fecha: fechaHoy,
      fuente: 'banxico',
      cached: false,
      vigente_desde: vigencia.vigente_desde,
      vigente_hasta: vigencia.vigente_hasta,
    } satisfies TipoCambioResponse)
  } catch (error) {
    console.error('Error in tipo-cambio/hoy:', error)
    return NextResponse.json({
      ok: false,
      tipo_cambio: FALLBACK_RATE,
      fecha: todayMexico(),
      fuente: 'fallback',
      cached: false,
      mensaje: 'Error interno del servidor.',
    } satisfies TipoCambioResponse)
  }
}
