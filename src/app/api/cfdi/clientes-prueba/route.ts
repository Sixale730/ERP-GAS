/**
 * API Route para Clientes de Prueba SAT
 * GET /api/cfdi/clientes-prueba
 *
 * Solo disponible en ambiente demo.
 * Retorna la lista de receptores de prueba del SAT.
 */

import { NextResponse } from 'next/server'
import {
  CLIENTES_PRUEBA_SAT,
  getClientesPruebaAgrupados,
} from '@/lib/config/clientes-prueba'
import { getFinkokConfig } from '@/lib/config/finkok'

export async function GET() {
  const config = getFinkokConfig()

  // Solo disponible en ambiente demo
  if (config.environment !== 'demo') {
    return NextResponse.json(
      {
        success: false,
        error: 'Los clientes de prueba solo estan disponibles en ambiente demo',
      },
      { status: 403 }
    )
  }

  const agrupados = getClientesPruebaAgrupados()

  return NextResponse.json({
    success: true,
    ambiente: config.environment,
    clientes: CLIENTES_PRUEBA_SAT,
    agrupados,
  })
}
