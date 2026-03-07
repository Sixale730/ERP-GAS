import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPRESA, EMPRESA_PRUEBAS, type EmpresaData } from './empresa'
import { getFinkokConfig } from './finkok'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = SupabaseClient<any, any, any>

/**
 * Obtiene datos fiscales del emisor desde la BD para una organización.
 * En modo demo de Finkok, siempre retorna EMPRESA_PRUEBAS.
 * Fallback por campo a EMPRESA si la org no tiene datos completos.
 */
export async function getEmpresaByOrgId(
  supabase: SupabaseAny,
  organizacionId: string
): Promise<EmpresaData> {
  const config = getFinkokConfig()
  if (config.environment === 'demo') {
    return EMPRESA_PRUEBAS
  }

  const { data } = await supabase
    .schema('erp' as 'public')
    .from('organizaciones')
    .select('razon_social, rfc, regimen_fiscal, direccion, codigo_postal, telefono, email, logo_url')
    .eq('id', organizacionId)
    .single()

  if (data?.rfc) {
    return {
      nombre: data.razon_social || EMPRESA.nombre,
      rfc: data.rfc,
      direccion: data.direccion || EMPRESA.direccion,
      telefono: data.telefono || EMPRESA.telefono,
      email: data.email || EMPRESA.email,
      logo: data.logo_url || EMPRESA.logo,
      regimenFiscal: data.regimen_fiscal || EMPRESA.regimenFiscal,
      codigoPostal: data.codigo_postal || EMPRESA.codigoPostal,
    }
  }

  return EMPRESA
}

/**
 * Obtiene datos del emisor a partir del usuario autenticado.
 * Para uso en API routes donde ya existe un supabase client autenticado.
 */
export async function getEmpresaFromUser(
  supabase: SupabaseAny
): Promise<EmpresaData> {
  const config = getFinkokConfig()
  if (config.environment === 'demo') {
    return EMPRESA_PRUEBAS
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return EMPRESA

  const { data: erpUser } = await supabase
    .schema('erp' as 'public')
    .from('usuarios')
    .select('organizacion_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!erpUser?.organizacion_id) return EMPRESA

  return getEmpresaByOrgId(supabase, erpUser.organizacion_id)
}
