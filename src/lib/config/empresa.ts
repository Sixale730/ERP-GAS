// Configuración de la empresa para documentos PDF y CFDI
export const EMPRESA = {
  nombre: 'GAS Company',
  rfc: 'GAS123456ABC',
  direccion: 'Calle Principal #123, Col. Centro, CDMX, CP 06000',
  telefono: '(55) 1234-5678',
  email: 'ventas@gascompany.com',
  // Logo en base64 o ruta pública (opcional)
  logo: null as string | null,
  // Datos fiscales para CFDI
  regimenFiscal: '601', // General de Ley Personas Morales
  codigoPostal: '06000', // CP del lugar de expedicion
}

// Datos de prueba para ambiente DEMO de Finkok
// Usar estos datos cuando FINKOK_ENVIRONMENT=demo
export const EMPRESA_PRUEBAS = {
  nombre: 'ESCUELA KEMPER URGATE SA DE CV',
  rfc: 'EKU9003173C9',
  direccion: 'Calle de Prueba #123, Col. Centro, Tijuana, BC, CP 21000',
  telefono: '(664) 123-4567',
  email: 'pruebas@eku.com',
  logo: null as string | null,
  regimenFiscal: '601',
  codigoPostal: '21000',
}
