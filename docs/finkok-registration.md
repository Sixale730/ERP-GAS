# Finkok Registration API - Documentación

Este módulo permite gestionar los clientes/RFCs que pueden timbrar bajo una cuenta de socio de negocios de Finkok.

## URLs del Servicio

| Ambiente | URL |
|----------|-----|
| Demo | `https://demo-facturacion.finkok.com/servicios/soap/registration.wsdl` |
| Producción | `https://facturacion.finkok.com/servicios/soap/registration.wsdl` |

## Instalación

El módulo está ubicado en `src/lib/cfdi/finkok/registration.ts`.

```typescript
import {
  addClient,
  assignCredits,
  editClient,
  getClient,
  switchClient,
  getCustomers,
  getAllCustomers,
} from '@/lib/cfdi/finkok/registration'
```

## Configuración

Las credenciales se configuran en `.env.local`:

```env
FINKOK_USER=tu_usuario@finkok.com
FINKOK_PASSWORD=tu_password
FINKOK_ENVIRONMENT=demo  # o 'production'
```

---

## Métodos Disponibles

### 1. addClient - Agregar Cliente

Registra un nuevo RFC para poder timbrar.

```typescript
import { addClient } from '@/lib/cfdi/finkok/registration'

const result = await addClient({
  taxpayer_id: 'AAA010101AAA',  // RFC del cliente
  type_user: 'P',               // 'O' = OnDemand (ilimitado), 'P' = Prepago
})

if (result.success) {
  console.log('Cliente agregado:', result.message)
} else {
  console.error('Error:', result.error)
}
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `taxpayer_id` | string | Sí | RFC del cliente |
| `type_user` | 'O' \| 'P' | Sí | Tipo: OnDemand o Prepago |
| `cer` | string | No | Certificado .cer en Base64 |
| `key` | string | No | Llave .key en Base64 |
| `passphrase` | string | No | Contraseña de la llave |
| `coupon` | string | No | Cupón de descuento |

#### Respuesta

```typescript
{
  success: boolean
  message: string      // "Account Created successfully"
  error?: string
}
```

---

### 2. assignCredits - Asignar Timbres

Asigna timbres a un cliente en modo Prepago.

```typescript
import { assignCredits } from '@/lib/cfdi/finkok/registration'

const result = await assignCredits({
  taxpayer_id: 'AAA010101AAA',
  credit: 100,  // Cantidad de timbres a asignar
})

if (result.success) {
  console.log(`Total de timbres: ${result.credit}`)
}
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `taxpayer_id` | string | Sí | RFC del cliente |
| `credit` | number | Sí | Cantidad de timbres |

#### Respuesta

```typescript
{
  success: boolean
  credit: number       // Total de timbres después de asignar
  message: string      // "Success, added 100 of credit to AAA010101AAA"
  error?: string
}
```

---

### 3. editClient - Editar Cliente

Edita un cliente: activar/suspender o cargar certificados CSD.

#### Activar/Suspender

```typescript
import { editClient } from '@/lib/cfdi/finkok/registration'

// Suspender cliente
await editClient({
  taxpayer_id: 'AAA010101AAA',
  status: 'S',  // 'A' = Activar, 'S' = Suspender
})

// Activar cliente
await editClient({
  taxpayer_id: 'AAA010101AAA',
  status: 'A',
})
```

#### Cargar CSD

```typescript
import { editClient } from '@/lib/cfdi/finkok/registration'
import { readFileSync } from 'fs'

const cerBase64 = readFileSync('certificado.cer').toString('base64')
const keyBase64 = readFileSync('llave.key').toString('base64')

await editClient({
  taxpayer_id: 'AAA010101AAA',
  cer: cerBase64,
  key: keyBase64,
  passphrase: '12345678a',
})
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `taxpayer_id` | string | Sí | RFC del cliente |
| `status` | 'A' \| 'S' | No | Activar o Suspender |
| `cer` | string | No | Certificado .cer en Base64 |
| `key` | string | No | Llave .key en Base64 |
| `passphrase` | string | No | Contraseña de la llave |

#### Respuesta

```typescript
{
  success: boolean
  message: string      // "Account Suspended successfully"
  error?: string
}
```

---

### 4. getClient - Obtener Cliente

Obtiene información de un cliente específico.

```typescript
import { getClient } from '@/lib/cfdi/finkok/registration'

const result = await getClient('AAA010101AAA')

if (result.success && result.users?.[0]) {
  const client = result.users[0]
  console.log(`RFC: ${client.taxpayer_id}`)
  console.log(`Estado: ${client.status}`)           // 'A' o 'S'
  console.log(`Timbres usados este mes: ${client.counter}`)
  console.log(`Timbres disponibles: ${client.credit}`)  // -1 = ilimitado
}
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `taxpayer_id` | string | Sí | RFC del cliente |

#### Respuesta

```typescript
{
  success: boolean
  users?: Array<{
    status: 'A' | 'S'    // Activo o Suspendido
    counter: number      // Timbres usados en el mes
    taxpayer_id: string  // RFC
    credit: number       // Timbres disponibles (-1 = ilimitado)
  }>
  message?: string
  error?: string
}
```

---

### 5. switchClient - Cambiar Tipo

Cambia el tipo de cliente entre OnDemand (ilimitado) y Prepago (limitado).

```typescript
import { switchClient } from '@/lib/cfdi/finkok/registration'

// Cambiar a OnDemand (ilimitado)
await switchClient({
  taxpayer_id: 'AAA010101AAA',
  type_user: 'O',
})

// Cambiar a Prepago (limitado por timbres)
await switchClient({
  taxpayer_id: 'AAA010101AAA',
  type_user: 'P',
})
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `taxpayer_id` | string | Sí | RFC del cliente |
| `type_user` | 'O' \| 'P' | Sí | OnDemand o Prepago |

#### Respuesta

```typescript
{
  success: boolean
  message: string      // "Success, registration updated"
  error?: string
}
```

---

### 6. getCustomers - Listar Clientes

Lista todos los clientes registrados (paginado, 50 por página).

```typescript
import { getCustomers } from '@/lib/cfdi/finkok/registration'

// Página 1
const result = await getCustomers(1)

console.log(result.message)  // "Showing 1 to 50 of 100 entries"

for (const client of result.users) {
  console.log(`${client.taxpayer_id}: ${client.credit} timbres`)
}
```

#### Parámetros

| Nombre | Tipo | Requerido | Descripción |
|--------|------|-----------|-------------|
| `page` | number | No | Número de página (default: 1) |

#### Respuesta

```typescript
{
  success: boolean
  message: string      // "Showing 1 to 50 of X entries"
  users: Array<{
    status: 'A' | 'S'
    counter: number
    taxpayer_id: string
    credit: number
  }>
  error?: string
}
```

---

### 7. getAllCustomers - Listar Todos

Obtiene todos los clientes (todas las páginas automáticamente).

```typescript
import { getAllCustomers } from '@/lib/cfdi/finkok/registration'

const result = await getAllCustomers()

console.log(`Total: ${result.users.length} clientes`)

for (const client of result.users) {
  console.log(`${client.taxpayer_id}: ${client.status}`)
}
```

---

## Tipos TypeScript

```typescript
// Tipo de usuario
type FinkokUserType = 'O' | 'P'  // OnDemand o Prepago

// Estado del cliente
type FinkokClientStatus = 'A' | 'S'  // Activo o Suspendido

// Datos del cliente
interface FinkokResellerUser {
  status: FinkokClientStatus
  counter: number        // Timbres usados en el mes
  taxpayer_id: string    // RFC
  credit: number         // Timbres disponibles (-1 = ilimitado)
}
```

---

## Notas Importantes

### Tipos de Usuario

| Tipo | Descripción |
|------|-------------|
| `O` (OnDemand) | El cliente puede timbrar ilimitadamente. Los timbres se cobran según uso. |
| `P` (Prepago) | El cliente tiene un número limitado de timbres. Debe asignarse crédito con `assignCredits`. |

### Estados del Cliente

| Estado | Descripción |
|--------|-------------|
| `A` (Activo) | El cliente puede timbrar normalmente. |
| `S` (Suspendido) | El cliente no puede timbrar hasta que se reactive. |

### Créditos

- Un valor de `credit: -1` indica que el cliente es OnDemand (ilimitado).
- Un valor positivo indica los timbres restantes en modo Prepago.

### Errores Comunes

| Código | Descripción |
|--------|-------------|
| 300 | Usuario o contraseña inválidos |
| 702 | RFC no registrado en la cuenta |
| 703 | Cuenta suspendida |

---

## Gestión de Certificados CSD

Los Certificados de Sello Digital (CSD) son necesarios para firmar los CFDI. El sistema soporta dos modos de operación:

### Modo Demo (Firma Local)

En ambiente de desarrollo/demo, el sistema firma localmente con los certificados de prueba:

- Los certificados están en `public/csd-pruebas/`
- RFC de pruebas: `EKU9003173C9`
- Contraseña: `12345678a`
- Se usa el método `stamp()` o `quick_stamp()` de Finkok

### Modo Producción (sign_stamp)

En producción, los CSD se cargan a Finkok y ellos firman:

1. **Cargar CSD via UI**: El usuario sube los archivos `.cer` y `.key`
2. **API procesa**: Los archivos se convierten a Base64 y se envían a Finkok
3. **Finkok almacena**: Los certificados quedan en Finkok asociados al RFC
4. **Timbrar**: Se usa `sign_stamp()` que firma y timbra en un solo paso

### API de CSD

#### Cargar CSD (POST /api/cfdi/csd)

```typescript
// Con archivos
const formData = new FormData()
formData.append('cer', archivocer)
formData.append('key', archivoKey)
formData.append('passphrase', 'contrasena')
formData.append('taxpayer_id', 'AAA010101AAA')  // opcional

await fetch('/api/cfdi/csd', {
  method: 'POST',
  body: formData
})

// O cargar los de prueba
await fetch('/api/cfdi/csd', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usarPruebas: true })
})
```

#### Verificar CSD (GET /api/cfdi/csd)

```typescript
const response = await fetch('/api/cfdi/csd?rfc=AAA010101AAA')
const data = await response.json()
// { success: true, rfc: 'AAA010101AAA', tieneCSD: true, ambiente: 'demo' }
```

### Utilidades CSD

```typescript
import {
  cargarCSDaFinkok,
  cargarCSDPruebas,
  verificarCSDEnFinkok,
  leerCSDArchivos,
  bufferToBase64,
} from '@/lib/cfdi/finkok/csd-utils'

// Cargar archivos desde disco
const { cer, key } = leerCSDArchivos('./cert.cer', './llave.key')

// Cargar a Finkok
await cargarCSDaFinkok({
  taxpayer_id: 'AAA010101AAA',
  cerBase64: cer,
  keyBase64: key,
  passphrase: 'contrasena',
})

// Verificar si tiene CSD
const tiene = await verificarCSDEnFinkok('AAA010101AAA')
```

### Componente UI

```tsx
import CSDUploader from '@/components/cfdi/CSDUploader'

<CSDUploader
  defaultRFC="AAA010101AAA"
  onSuccess={() => console.log('CSD cargados')}
/>
```

### Flujo de Timbrado

El sistema detecta automáticamente el ambiente:

```
DEMO                                  PRODUCCIÓN
────────────────────                  ────────────────────
1. Generar XML pre-CFDI               1. Generar XML pre-CFDI
2. Generar cadena original            2. Enviar a sign_stamp()
3. Firmar localmente                  3. Finkok firma y timbra
4. Agregar sello/certificado          4. Recibir XML timbrado
5. Enviar a stamp()
6. Recibir XML timbrado
```

### Seguridad

- Los archivos `.key` NUNCA se almacenan en nuestra base de datos
- Solo se envían a Finkok via HTTPS
- Finkok los almacena de forma segura
- El passphrase solo se usa para validar y se descarta

---

## Referencias

- [Wiki Finkok - Registro de Clientes](https://wiki.finkok.com/en/home/webservices/registro_de_clientes)
- [Wiki Finkok - sign_stamp](https://wiki.finkok.com/home/webservices/ws_timbrado/Sign_stamp)
- [Soporte Finkok](https://support.finkok.com/)
