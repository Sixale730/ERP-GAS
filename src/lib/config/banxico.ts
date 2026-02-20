/**
 * Configuracion de la API de Banxico para Tipo de Cambio FIX
 *
 * IMPORTANTE: Para usar este servicio necesitas un token de Banxico:
 * 1. Registrate en https://www.banxico.org.mx/SieAPIRest/service/v1/token
 * 2. Agrega tu token en .env.local como BANXICO_TOKEN
 *
 * Serie SF43718 = Tipo de cambio FIX (pesos por dolar EUA)
 */

export const BANXICO_BASE_URL = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series'
export const SERIE_FIX = 'SF43718'

export interface BanxicoConfig {
  token: string
  baseUrl: string
  serieFix: string
}

/**
 * Obtiene la configuracion de Banxico desde variables de entorno
 */
export function getBanxicoConfig(): BanxicoConfig {
  return {
    token: process.env.BANXICO_TOKEN || '',
    baseUrl: BANXICO_BASE_URL,
    serieFix: SERIE_FIX,
  }
}

/**
 * Verifica si el token de Banxico esta configurado
 */
export function isBanxicoConfigured(): boolean {
  return Boolean(process.env.BANXICO_TOKEN)
}
