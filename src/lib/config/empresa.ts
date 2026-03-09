// Tipo compartido para datos fiscales del emisor
export interface EmpresaData {
  nombre: string
  rfc: string
  direccion: string
  telefono: string
  email: string
  logo: string
  regimenFiscal: string
  codigoPostal: string
}

// Configuración de la empresa para documentos PDF y CFDI
export const EMPRESA: EmpresaData = {
  nombre: 'SOLAC',
  rfc: 'MOCD830414SL4',
  direccion: 'Calle Magnolia #266, CP 45403, Jalisco',
  telefono: '(33) 1013-1166',
  email: 'ventas@solac.com.mx',
  // Logo en base64 o ruta pública (opcional)
  logo: '/solac.png',
  // Datos fiscales para CFDI
  regimenFiscal: '601', // General de Ley Personas Morales
  codigoPostal: '45403', // CP del lugar de expedicion
}

// Datos de prueba para ambiente DEMO de Finkok
// Usar estos datos cuando FINKOK_ENVIRONMENT=demo
// IMPORTANTE: El nombre debe coincidir EXACTAMENTE con el registrado en el SAT
export const EMPRESA_PRUEBAS: EmpresaData = {
  nombre: 'ESCUELA KEMPER URGATE',
  rfc: 'EKU9003173C9',
  direccion: 'Calle de Prueba #123, Col. Centro, Tijuana, BC, CP 21000',
  telefono: '(664) 123-4567',
  email: 'pruebas@eku.com',
  logo: '/solac.png',
  regimenFiscal: '601',
  codigoPostal: '21000',
}
