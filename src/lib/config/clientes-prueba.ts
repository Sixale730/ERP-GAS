/**
 * Clientes de Prueba SAT para ambiente Demo
 *
 * Estos son los receptores oficiales del SAT para pruebas de timbrado.
 * Solo se muestran en ambiente demo (FINKOK_ENVIRONMENT=demo).
 */

export interface ClientePruebaSAT {
  rfc: string
  razon_social: string
  codigo_postal: string
  regimen_fiscal: string
  tipo: 'moral' | 'fisica'
  regimenes_permitidos: string[]
}

/**
 * Receptores de prueba del SAT
 * Fuente: Portal del SAT - Factura Electronica
 */
export const CLIENTES_PRUEBA_SAT: ClientePruebaSAT[] = [
  // Persona Moral
  {
    rfc: 'ICV060329BY0',
    razon_social: 'INMOBILIARIA CVA',
    codigo_postal: '33826',
    regimen_fiscal: '601',
    tipo: 'moral',
    regimenes_permitidos: ['601', '603', '610', '620', '622', '623', '624', '626'],
  },
  {
    rfc: 'ABC970528UHA',
    razon_social: 'ARENA BLANCA SCL DE CV',
    codigo_postal: '80290',
    regimen_fiscal: '601',
    tipo: 'moral',
    regimenes_permitidos: ['601', '603', '610', '620', '622', '623', '624', '626'],
  },
  {
    rfc: 'CTE950627K46',
    razon_social: 'COMERCIALIZADORA TEODORIKAS',
    codigo_postal: '57740',
    regimen_fiscal: '601',
    tipo: 'moral',
    regimenes_permitidos: ['601', '603', '610', '620', '622', '623', '624', '626'],
  },
  // Persona Fisica
  {
    rfc: 'MASO451221PM4',
    razon_social: 'MARIA OLIVIA MARTINEZ SAGAZ',
    codigo_postal: '80290',
    regimen_fiscal: '612',
    tipo: 'fisica',
    regimenes_permitidos: ['605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'],
  },
  {
    rfc: 'AABF800614HI0',
    razon_social: 'FELIX MANUEL ANDRADE BALLADO',
    codigo_postal: '86400',
    regimen_fiscal: '612',
    tipo: 'fisica',
    regimenes_permitidos: ['605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'],
  },
  {
    rfc: 'CUSC850516316',
    razon_social: 'CESAR OSBALDO CRUZ SOLORZANO',
    codigo_postal: '45638',
    regimen_fiscal: '612',
    tipo: 'fisica',
    regimenes_permitidos: ['605', '606', '607', '608', '610', '611', '612', '614', '615', '616', '621', '625', '626'],
  },
]

/**
 * Obtiene un cliente de prueba por RFC
 */
export function getClientePrueba(rfc: string): ClientePruebaSAT | undefined {
  return CLIENTES_PRUEBA_SAT.find((c) => c.rfc === rfc)
}

/**
 * Obtiene clientes de prueba agrupados por tipo
 */
export function getClientesPruebaAgrupados(): {
  moral: ClientePruebaSAT[]
  fisica: ClientePruebaSAT[]
} {
  return {
    moral: CLIENTES_PRUEBA_SAT.filter((c) => c.tipo === 'moral'),
    fisica: CLIENTES_PRUEBA_SAT.filter((c) => c.tipo === 'fisica'),
  }
}

/**
 * Clientes que se insertan por defecto en la BD (solo 2)
 */
export const CLIENTES_DEFAULT = [
  CLIENTES_PRUEBA_SAT[0], // ICV060329BY0 - Persona Moral
  CLIENTES_PRUEBA_SAT[3], // MASO451221PM4 - Persona Fisica
]
