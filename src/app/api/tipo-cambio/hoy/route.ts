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
}

const FALLBACK_RATE = 17.50

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

async function getLastKnownRate(supabase: any): Promise<{ valor: number; fecha: string } | null> {
  try {
    const { data } = await supabase
      .schema('erp')
      .from('tipo_cambio_diario')
      .select('valor, fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    return data ? { valor: Number(data.valor), fecha: data.fecha } : null
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

    // Check cache in tipo_cambio_diario
    if (!force) {
      const { data: cached } = await supabase
        .schema('erp')
        .from('tipo_cambio_diario')
        .select('valor, fecha, fuente')
        .eq('fecha', fechaHoy)
        .single()

      if (cached) {
        return NextResponse.json({
          ok: true,
          tipo_cambio: Number(cached.valor),
          fecha: cached.fecha,
          fuente: cached.fuente,
          cached: true,
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
          { fecha: fechaHoy, valor, fuente: 'banxico', serie: config.serieFix },
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

    return NextResponse.json({
      ok: true,
      tipo_cambio: valor,
      fecha: fechaHoy,
      fuente: 'banxico',
      cached: false,
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
