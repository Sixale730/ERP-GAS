'use client'

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { EMPRESA, type EmpresaData } from '@/lib/config/empresa'

/**
 * Hook client-side que deriva EmpresaData del contexto de auth.
 * No hace queries adicionales — los datos fiscales de la org
 * ya vienen en obtener_usuario_actual().
 */
export function useEmpresa(): { empresa: EmpresaData; loading: boolean } {
  const { organizacion, loading } = useAuth()

  const empresa = useMemo<EmpresaData>(() => {
    if (!organizacion?.rfc) {
      return EMPRESA
    }
    return {
      nombre: organizacion.razon_social || EMPRESA.nombre,
      rfc: organizacion.rfc,
      direccion: organizacion.direccion || EMPRESA.direccion,
      telefono: organizacion.telefono || EMPRESA.telefono,
      email: organizacion.email || EMPRESA.email,
      logo: organizacion.logo_url || EMPRESA.logo,
      regimenFiscal: organizacion.regimen_fiscal || EMPRESA.regimenFiscal,
      codigoPostal: organizacion.codigo_postal || EMPRESA.codigoPostal,
    }
  }, [organizacion])

  return { empresa, loading }
}
