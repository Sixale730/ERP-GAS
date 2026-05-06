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
  /**
   * TC ya publicado por Banxico pero aun no vigente. Se hace efectivo el
   * `proximo_vigente_desde`. Util para mostrar como info en la UI ("TC de
   * manana: 17.xxxx") sin afectar calculos. Solo aparece despues de las
   * 12:00 PM hora MX el dia que Banxico publica.
   */
  tipo_cambio_proximo?: number | null
  proximo_vigente_desde?: string | null
  proximo_fecha?: string | null
}

const FALLBACK_RATE = 17.50

/**
 * Calcula la vigencia para un TC publicado en la fecha `fechaPublicacion`
 * (formato YYYY-MM-DD). La regla Banxico FIX dice: el TC publicado el dia D
 * a las 12 PM rige todo el dia D+1 (de 00:00 a 23:59 hora MX).
 *
 * IMPORTANTE: la fecha que importa es la que reporta Banxico en
 * `dato.fecha`, NO la fecha en la que llamamos al endpoint. Si consultamos
 * antes de las 12 PM, Banxico devuelve el TC del dia habil anterior (que
 * fue publicado AYER y rige HOY). Si consultamos despues, devuelve el de
 * hoy (publicado hoy y rige mañana).
 *
 * MX no observa DST desde 2022 (federal), offset fijo -06:00.
 */
function computeVigenciaFromFecha(fechaPublicacion: string): { vigente_desde: string; vigente_hasta: string } {
  const [yStr, mStr, dStr] = fechaPublicacion.split('-')
  const y = Number(yStr); const m = Number(mStr); const d = Number(dStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  const addDaysUTC = (yy: number, mm: number, dd: number, n: number) => {
    const t = new Date(Date.UTC(yy, mm - 1, dd + n))
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }
  }
  // D+1 a las 00:00 hora MX y D+2 a las 00:00 hora MX
  const t1 = addDaysUTC(y, m, d, 1)
  const t2 = addDaysUTC(y, m, d, 2)
  const vigente_desde = new Date(`${t1.y}-${pad(t1.m)}-${pad(t1.d)}T00:00:00-06:00`).toISOString()
  const vigente_hasta = new Date(`${t2.y}-${pad(t2.m)}-${pad(t2.d)}T00:00:00-06:00`).toISOString()
  return { vigente_desde, vigente_hasta }
}

/** Convierte "05/05/2026" (dd/mm/yyyy de Banxico) a "2026-05-05". */
function parseBanxicoFecha(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
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
    // Solo retornar registros que YA estuvieron vigentes (vigente_desde <= NOW()).
    // Si filtramos solo por fecha desc, podriamos retornar un TC del futuro
    // (ej. publicado hoy con vigencia mañana) cuando hay un hueco entre
    // vigencias. Eso confundiria al usuario mostrandole el TC de mañana
    // como si fuera el de hoy.
    const nowUtc = new Date().toISOString()
    const { data } = await supabase
      .schema('erp')
      .from('tipo_cambio_diario')
      .select('valor, fecha, vigente_desde, vigente_hasta')
      .lte('vigente_desde', nowUtc)
      .order('vigente_desde', { ascending: false })
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

/**
 * TC publicado pero AUN NO vigente — el primero cuyo `vigente_desde` es
 * mayor a NOW(). Solo existe entre las 12:00 PM y las 23:59 PM del dia que
 * Banxico publica (entra en vigor a las 00:00 del dia siguiente).
 * Se devuelve en el response para que la UI lo muestre como info ("TC de
 * manana: ..."), sin afectar calculos.
 */
async function getNextRate(supabase: any): Promise<{ valor: number; fecha: string; vigente_desde: string } | null> {
  try {
    const nowUtc = new Date().toISOString()
    const { data } = await supabase
      .schema('erp')
      .from('tipo_cambio_diario')
      .select('valor, fecha, vigente_desde')
      .gt('vigente_desde', nowUtc)
      .order('vigente_desde', { ascending: true })
      .limit(1)
      .single()
    return data ? { valor: Number(data.valor), fecha: data.fecha, vigente_desde: data.vigente_desde } : null
  } catch {
    return null
  }
}

/**
 * Sincroniza `erp.configuracion` con el TC effective (vigente AHORA), no
 * con el recien bajado de Banxico (que puede ser el del dia siguiente).
 * Garantiza que cualquier consumidor de `useConfiguracion()` lea el TC
 * correcto segun la regla "publicado en D rige en D+1".
 */
async function syncConfiguracionWithEffective(supabase: any): Promise<void> {
  try {
    const effective = await getEffectiveRate(supabase)
    if (!effective) return
    await supabase
      .schema('erp')
      .from('configuracion')
      .update({ valor: { valor: effective.valor, fecha: effective.fecha } })
      .eq('clave', 'tipo_cambio')
  } catch (err) {
    console.error('Error syncing configuracion with effective rate:', err)
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
        const next = await getNextRate(supabase)
        return NextResponse.json({
          ok: true,
          tipo_cambio: effective.valor,
          fecha: effective.fecha,
          fuente: effective.fuente,
          cached: true,
          vigente_desde: effective.vigente_desde,
          vigente_hasta: effective.vigente_hasta,
          tipo_cambio_proximo: next?.valor ?? null,
          proximo_vigente_desde: next?.vigente_desde ?? null,
          proximo_fecha: next?.fecha ?? null,
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

    // Save to tipo_cambio_diario (upsert).
    // OJO: la fecha QUE IMPORTA es la que Banxico reporta (`dato.fecha`),
    // NO la fecha en la que llamamos al endpoint. Si consultamos antes de
    // 12 PM, Banxico devuelve el TC del dia habil anterior (publicado
    // ayer y vigente HOY). Si consultamos despues, el de hoy (vigente
    // mañana). Por eso la vigencia se calcula desde fechaBanxico, no
    // desde fechaHoy.
    const fechaBanxicoStr = (dato as { fecha?: string } | undefined)?.fecha
    const fechaPublicacion = (fechaBanxicoStr && parseBanxicoFecha(fechaBanxicoStr)) || fechaHoy
    try {
      await supabase
        .schema('erp')
        .from('tipo_cambio_diario')
        .upsert(
          {
            fecha: fechaPublicacion,
            valor,
            fuente: 'banxico',
            serie: config.serieFix,
            ...computeVigenciaFromFecha(fechaPublicacion),
          },
          { onConflict: 'fecha' }
        )
    } catch (dbError) {
      console.error('Error saving tipo_cambio_diario:', dbError)
    }

    // Sincronizar erp.configuracion con el TC effective (vigente AHORA).
    // OJO: NO escribimos `valor` (recien bajado), porque ese aplica
    // mañana — escribirlo en `configuracion` haria que el resto de la app
    // muestre el TC del dia siguiente desde las 12 PM hasta las 23:59.
    await syncConfiguracionWithEffective(supabase)

    // Return the effective rate for today (not the just-fetched one which applies tomorrow)
    const effective = await getEffectiveRate(supabase)
    const next = await getNextRate(supabase)
    if (effective) {
      return NextResponse.json({
        ok: true,
        tipo_cambio: effective.valor,
        fecha: effective.fecha,
        fuente: effective.fuente,
        cached: false,
        vigente_desde: effective.vigente_desde,
        vigente_hasta: effective.vigente_hasta,
        tipo_cambio_proximo: next?.valor ?? null,
        proximo_vigente_desde: next?.vigente_desde ?? null,
        proximo_fecha: next?.fecha ?? null,
      } satisfies TipoCambioResponse)
    }

    // Fallback: no effective rate yet (first time), return the just-fetched one
    const vigencia = computeVigenciaFromFecha(fechaPublicacion)
    return NextResponse.json({
      ok: true,
      tipo_cambio: valor,
      fecha: fechaPublicacion,
      fuente: 'banxico',
      cached: false,
      vigente_desde: vigencia.vigente_desde,
      vigente_hasta: vigencia.vigente_hasta,
      tipo_cambio_proximo: next?.valor ?? null,
      proximo_vigente_desde: next?.vigente_desde ?? null,
      proximo_fecha: next?.fecha ?? null,
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
