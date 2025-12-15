/**
 * Servicio de Registro de Clientes de Finkok
 *
 * Este modulo permite gestionar los RFCs que pueden timbrar
 * bajo una cuenta de socio de negocios de Finkok.
 *
 * Documentacion: https://wiki.finkok.com/en/home/webservices/registro_de_clientes
 */

import { getSOAPClient, getConfig } from './client'
import {
  FinkokAddClientParams,
  FinkokAddClientResponse,
  FinkokAssignCreditsParams,
  FinkokAssignCreditsResponse,
  FinkokEditClientParams,
  FinkokEditClientResponse,
  FinkokGetClientResponse,
  FinkokSwitchClientParams,
  FinkokSwitchClientResponse,
  FinkokCustomersResponse,
  FinkokResellerUser,
} from '../types'

// Interfaces para las respuestas SOAP de Finkok
interface AddResult {
  addResult?: {
    success?: boolean
    message?: string
  }
}

interface AssignResult {
  assignResult?: {
    success?: boolean
    credit?: number
    message?: string
  }
}

interface EditResult {
  editResult?: {
    success?: boolean
    message?: string
  }
}

interface GetResult {
  getResult?: {
    success?: boolean
    message?: string
    users?: {
      ResellerUser?: ResellerUserRaw | ResellerUserRaw[]
    }
  }
}

interface SwitchResult {
  switchResult?: {
    success?: boolean
    message?: string
  }
}

interface CustomersResult {
  customersResult?: {
    success?: boolean
    message?: string
    users?: {
      ResellerUser?: ResellerUserRaw | ResellerUserRaw[]
    }
  }
}

interface ResellerUserRaw {
  status?: string
  counter?: number | string
  taxpayer_id?: string
  credit?: number | string
}

/**
 * Parsea los usuarios de la respuesta SOAP
 */
function parseResellerUsers(users?: { ResellerUser?: ResellerUserRaw | ResellerUserRaw[] }): FinkokResellerUser[] {
  if (!users?.ResellerUser) return []

  const userList = Array.isArray(users.ResellerUser)
    ? users.ResellerUser
    : [users.ResellerUser]

  return userList.map(u => ({
    status: (u.status || 'S') as 'A' | 'S',
    counter: typeof u.counter === 'string' ? parseInt(u.counter, 10) : (u.counter || 0),
    taxpayer_id: u.taxpayer_id || '',
    credit: typeof u.credit === 'string' ? parseInt(u.credit, 10) : (u.credit || 0),
  }))
}

/**
 * Agrega un nuevo cliente/RFC para timbrar
 *
 * @param params - Parametros del cliente
 * @returns Resultado de la operacion
 *
 * @example
 * ```typescript
 * const result = await addClient({
 *   taxpayer_id: 'AAA010101AAA',
 *   type_user: 'P', // Prepago
 * })
 * ```
 */
export async function addClient(params: FinkokAddClientParams): Promise<FinkokAddClientResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        message: '',
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    const soapParams = {
      reseller_username: config.user,
      reseller_password: config.password,
      taxpayer_id: params.taxpayer_id,
      type_user: params.type_user,
      ...(params.cer && { cer: params.cer }),
      ...(params.key && { key: params.key }),
      ...(params.passphrase && { passphrase: params.passphrase }),
      ...(params.coupon && { coupon: params.coupon }),
    }

    const [result]: [AddResult] = await client.addAsync(soapParams)

    const addResult = result.addResult
    if (!addResult) {
      return {
        success: false,
        message: '',
        error: 'Respuesta vacia del servidor',
      }
    }

    return {
      success: addResult.success || false,
      message: addResult.message || '',
      error: addResult.success ? undefined : addResult.message,
    }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : 'Error al agregar cliente',
    }
  }
}

/**
 * Asigna timbres/creditos a un cliente en modo Prepago
 *
 * @param params - RFC y cantidad de timbres
 * @returns Resultado con el total de timbres
 *
 * @example
 * ```typescript
 * const result = await assignCredits({
 *   taxpayer_id: 'AAA010101AAA',
 *   credit: 100,
 * })
 * console.log(`Total de timbres: ${result.credit}`)
 * ```
 */
export async function assignCredits(params: FinkokAssignCreditsParams): Promise<FinkokAssignCreditsResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        credit: 0,
        message: '',
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    // Nota: Este metodo usa 'username' y 'password' (sin prefijo reseller_)
    const soapParams = {
      username: config.user,
      password: config.password,
      taxpayer_id: params.taxpayer_id,
      credit: params.credit.toString(),
    }

    const [result]: [AssignResult] = await client.assignAsync(soapParams)

    const assignResult = result.assignResult
    if (!assignResult) {
      return {
        success: false,
        credit: 0,
        message: '',
        error: 'Respuesta vacia del servidor',
      }
    }

    return {
      success: assignResult.success || false,
      credit: assignResult.credit || 0,
      message: assignResult.message || '',
      error: assignResult.success ? undefined : assignResult.message,
    }
  } catch (error) {
    return {
      success: false,
      credit: 0,
      message: '',
      error: error instanceof Error ? error.message : 'Error al asignar creditos',
    }
  }
}

/**
 * Edita un cliente existente: activar/suspender o cargar CSD
 *
 * @param params - Parametros a editar
 * @returns Resultado de la operacion
 *
 * @example
 * ```typescript
 * // Suspender cliente
 * await editClient({ taxpayer_id: 'AAA010101AAA', status: 'S' })
 *
 * // Cargar CSD
 * await editClient({
 *   taxpayer_id: 'AAA010101AAA',
 *   cer: cerBase64,
 *   key: keyBase64,
 *   passphrase: '12345678a',
 * })
 * ```
 */
export async function editClient(params: FinkokEditClientParams): Promise<FinkokEditClientResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        message: '',
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    const soapParams = {
      reseller_username: config.user,
      reseller_password: config.password,
      taxpayer_id: params.taxpayer_id,
      ...(params.status && { status: params.status }),
      ...(params.cer && { cer: params.cer }),
      ...(params.key && { key: params.key }),
      ...(params.passphrase && { passphrase: params.passphrase }),
    }

    const [result]: [EditResult] = await client.editAsync(soapParams)

    const editResult = result.editResult
    if (!editResult) {
      return {
        success: false,
        message: '',
        error: 'Respuesta vacia del servidor',
      }
    }

    return {
      success: editResult.success || false,
      message: editResult.message || '',
      error: editResult.success ? undefined : editResult.message,
    }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : 'Error al editar cliente',
    }
  }
}

/**
 * Obtiene informacion de un cliente/RFC
 *
 * @param taxpayer_id - RFC del cliente
 * @returns Informacion del cliente
 *
 * @example
 * ```typescript
 * const result = await getClient('AAA010101AAA')
 * if (result.success && result.users?.[0]) {
 *   console.log(`Status: ${result.users[0].status}`)
 *   console.log(`Timbres usados: ${result.users[0].counter}`)
 *   console.log(`Timbres disponibles: ${result.users[0].credit}`)
 * }
 * ```
 */
export async function getClient(taxpayer_id: string): Promise<FinkokGetClientResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    const soapParams = {
      reseller_username: config.user,
      reseller_password: config.password,
      taxpayer_id,
    }

    const [result]: [GetResult] = await client.getAsync(soapParams)

    const getResult = result.getResult
    if (!getResult) {
      return {
        success: false,
        error: 'Respuesta vacia del servidor',
      }
    }

    const users = parseResellerUsers(getResult.users)

    return {
      success: users.length > 0,
      users,
      message: getResult.message,
      error: users.length === 0 ? 'Cliente no encontrado' : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al obtener cliente',
    }
  }
}

/**
 * Cambia el tipo de cliente entre OnDemand y Prepago
 *
 * @param params - RFC y nuevo tipo
 * @returns Resultado de la operacion
 *
 * @example
 * ```typescript
 * // Cambiar a OnDemand (ilimitado)
 * await switchClient({ taxpayer_id: 'AAA010101AAA', type_user: 'O' })
 *
 * // Cambiar a Prepago (limitado)
 * await switchClient({ taxpayer_id: 'AAA010101AAA', type_user: 'P' })
 * ```
 */
export async function switchClient(params: FinkokSwitchClientParams): Promise<FinkokSwitchClientResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        message: '',
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    // Nota: Este metodo usa 'username' y 'password' (sin prefijo reseller_)
    const soapParams = {
      username: config.user,
      password: config.password,
      taxpayer_id: params.taxpayer_id,
      type_user: params.type_user,
    }

    const [result]: [SwitchResult] = await client.switchAsync(soapParams)

    const switchResult = result.switchResult
    if (!switchResult) {
      return {
        success: false,
        message: '',
        error: 'Respuesta vacia del servidor',
      }
    }

    return {
      success: switchResult.success || false,
      message: switchResult.message || '',
      error: switchResult.success ? undefined : switchResult.message,
    }
  } catch (error) {
    return {
      success: false,
      message: '',
      error: error instanceof Error ? error.message : 'Error al cambiar tipo de cliente',
    }
  }
}

/**
 * Lista todos los clientes/RFCs registrados (paginado, 50 por pagina)
 *
 * @param page - Numero de pagina (default: 1)
 * @returns Lista de clientes
 *
 * @example
 * ```typescript
 * // Obtener primera pagina
 * const result = await getCustomers(1)
 * console.log(result.message) // "Showing 1 to 50 of 100 entries"
 *
 * for (const user of result.users) {
 *   console.log(`${user.taxpayer_id}: ${user.credit} timbres`)
 * }
 * ```
 */
export async function getCustomers(page: number = 1): Promise<FinkokCustomersResponse> {
  try {
    const config = getConfig()

    if (!config.user || !config.password) {
      return {
        success: false,
        message: '',
        users: [],
        error: 'Faltan credenciales de Finkok',
      }
    }

    const client = await getSOAPClient(config.urls.registration)

    // Nota: Este metodo usa 'username' y 'password' (sin prefijo reseller_)
    const soapParams = {
      username: config.user,
      password: config.password,
      page: page.toString(),
    }

    const [result]: [CustomersResult] = await client.customersAsync(soapParams)

    const customersResult = result.customersResult
    if (!customersResult) {
      return {
        success: false,
        message: '',
        users: [],
        error: 'Respuesta vacia del servidor',
      }
    }

    const users = parseResellerUsers(customersResult.users)

    return {
      success: true,
      message: customersResult.message || '',
      users,
    }
  } catch (error) {
    return {
      success: false,
      message: '',
      users: [],
      error: error instanceof Error ? error.message : 'Error al listar clientes',
    }
  }
}

/**
 * Obtiene todos los clientes (todas las paginas)
 *
 * @returns Lista completa de clientes
 *
 * @example
 * ```typescript
 * const allClients = await getAllCustomers()
 * console.log(`Total: ${allClients.users.length} clientes`)
 * ```
 */
export async function getAllCustomers(): Promise<FinkokCustomersResponse> {
  const allUsers: FinkokResellerUser[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const result = await getCustomers(page)

    if (!result.success || result.error) {
      return {
        success: false,
        message: result.message,
        users: allUsers,
        error: result.error,
      }
    }

    allUsers.push(...result.users)

    // Si recibimos menos de 50, ya no hay mas paginas
    if (result.users.length < 50) {
      hasMore = false
    } else {
      page++
    }
  }

  return {
    success: true,
    message: `Total: ${allUsers.length} clientes`,
    users: allUsers,
  }
}
