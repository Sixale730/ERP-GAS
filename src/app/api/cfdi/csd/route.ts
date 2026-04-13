/**
 * API Route para gestionar Certificados de Sello Digital (CSD)
 *
 * POST /api/cfdi/csd - Cargar CSD a Finkok
 * GET /api/cfdi/csd - Verificar estado de CSD
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  cargarCSDaFinkok,
  cargarCSDPruebas,
  verificarCSDEnFinkok,
  bufferToBase64,
} from '@/lib/cfdi/finkok/csd-utils'
import { getFinkokConfig, CSD_PRUEBAS } from '@/lib/config/finkok'

/** Verifica autenticación y permisos de configuración */
async function verificarAuthCSD() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 }) }
  }
  const { data: erpUser } = await supabase
    .schema('erp')
    .from('usuarios')
    .select('rol, permisos')
    .eq('auth_user_id', user.id)
    .single()
  if (!erpUser) {
    return { error: NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 }) }
  }
  const { getPermisosEfectivos } = await import('@/lib/permisos')
  const permisos = getPermisosEfectivos(erpUser.rol, erpUser.permisos)
  if (!permisos.configuracion?.editar) {
    return { error: NextResponse.json({ success: false, error: 'No tienes permisos para gestionar CSD' }, { status: 403 }) }
  }
  return { user, erpUser }
}

/**
 * POST /api/cfdi/csd
 *
 * Carga certificados CSD a Finkok.
 *
 * Body (FormData):
 * - cer: File (.cer)
 * - key: File (.key)
 * - passphrase: string
 * - taxpayer_id?: string (opcional, usa el RFC de pruebas si no se proporciona)
 *
 * O para cargar los de prueba:
 * Body (JSON):
 * - usarPruebas: true
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const auth = await verificarAuthCSD()
    if ('error' in auth) return auth.error

    const contentType = request.headers.get('content-type') || ''

    // Si es JSON, verificar si quiere cargar los de prueba
    if (contentType.includes('application/json')) {
      const body = await request.json()

      if (body.usarPruebas) {
        const result = await cargarCSDPruebas()
        return NextResponse.json(result)
      }

      return NextResponse.json(
        { success: false, message: 'Formato de solicitud invalido' },
        { status: 400 }
      )
    }

    // Si es FormData, procesar archivos
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()

      const cerFile = formData.get('cer') as File | null
      const keyFile = formData.get('key') as File | null
      const passphrase = formData.get('passphrase') as string | null
      const taxpayer_id = formData.get('taxpayer_id') as string | null

      // Validaciones
      if (!cerFile) {
        return NextResponse.json(
          { success: false, message: 'Falta el archivo de certificado (.cer)' },
          { status: 400 }
        )
      }

      if (!keyFile) {
        return NextResponse.json(
          { success: false, message: 'Falta el archivo de llave privada (.key)' },
          { status: 400 }
        )
      }

      if (!passphrase) {
        return NextResponse.json(
          { success: false, message: 'Falta la contraseña de la llave privada' },
          { status: 400 }
        )
      }

      // Verificar extensiones
      if (!cerFile.name.endsWith('.cer')) {
        return NextResponse.json(
          { success: false, message: 'El archivo de certificado debe tener extension .cer' },
          { status: 400 }
        )
      }

      if (!keyFile.name.endsWith('.key')) {
        return NextResponse.json(
          { success: false, message: 'El archivo de llave debe tener extension .key' },
          { status: 400 }
        )
      }

      // Leer archivos y convertir a Base64
      const cerArrayBuffer = await cerFile.arrayBuffer()
      const keyArrayBuffer = await keyFile.arrayBuffer()

      const cerBase64 = bufferToBase64(Buffer.from(cerArrayBuffer))
      const keyBase64 = bufferToBase64(Buffer.from(keyArrayBuffer))

      // Usar RFC proporcionado o el de pruebas
      const config = getFinkokConfig()
      const rfcFinal = taxpayer_id || (config.environment === 'demo' ? CSD_PRUEBAS.rfc : '')

      if (!rfcFinal) {
        return NextResponse.json(
          { success: false, message: 'Falta el RFC del emisor (taxpayer_id)' },
          { status: 400 }
        )
      }

      // Cargar a Finkok
      const result = await cargarCSDaFinkok({
        taxpayer_id: rfcFinal,
        cerBase64,
        keyBase64,
        passphrase,
      })

      return NextResponse.json(result)
    }

    return NextResponse.json(
      { success: false, message: 'Content-Type no soportado' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error al cargar CSD:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error interno al procesar la solicitud',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cfdi/csd
 *
 * Verifica el estado de CSD para un RFC.
 *
 * Query params:
 * - rfc: string (opcional, usa el RFC de pruebas si no se proporciona)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación y permisos
    const auth = await verificarAuthCSD()
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const rfc = searchParams.get('rfc')

    const config = getFinkokConfig()
    const rfcFinal = rfc || (config.environment === 'demo' ? CSD_PRUEBAS.rfc : '')

    if (!rfcFinal) {
      return NextResponse.json(
        { success: false, message: 'Falta el RFC a verificar' },
        { status: 400 }
      )
    }

    const tieneCSD = await verificarCSDEnFinkok(rfcFinal)

    return NextResponse.json({
      success: true,
      rfc: rfcFinal,
      tieneCSD,
      ambiente: config.environment,
      message: tieneCSD
        ? `El RFC ${rfcFinal} tiene CSD activos en Finkok`
        : `El RFC ${rfcFinal} no tiene CSD o no esta registrado`,
    })
  } catch (error) {
    console.error('Error al verificar CSD:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al verificar CSD',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
