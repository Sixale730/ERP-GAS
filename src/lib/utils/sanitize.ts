/**
 * Sanitiza input de usuario para uso seguro en filtros PostgREST (.or(), .filter()).
 * Elimina caracteres que PostgREST interpreta como operadores de filtro:
 * - Comas: separador de condiciones en .or()
 * - Paréntesis: agrupación de filtros
 *
 * Sin esta sanitización, un input como "test,id.eq.1" inyecta condiciones
 * adicionales en la query de Supabase.
 */
export function sanitizeSearchInput(input: string): string {
  return input.replace(/[,()]/g, '')
}
