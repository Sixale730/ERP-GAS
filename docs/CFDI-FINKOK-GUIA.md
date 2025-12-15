# Guia de Timbrado CFDI 4.0 con Finkok

Guia de referencia para implementar timbrado de CFDI 4.0 usando Finkok como PAC (Proveedor Autorizado de Certificacion).

---

## Metodos de Timbrado en Finkok

Finkok ofrece varios metodos para timbrar CFDI:

| Metodo | Descripcion | Requiere firma local |
|--------|-------------|---------------------|
| `stamp` | Timbrado tradicional, XML debe venir firmado | Si |
| `quick_stamp` | Version rapida de stamp | Si |
| `sign_stamp` | Finkok firma y timbra | **No** |

### Recomendacion: Usar `sign_stamp`

El metodo `sign_stamp` es el recomendado porque:

1. **No requiere generar cadena original localmente** - Finkok la genera internamente
2. **No requiere firmar con la llave privada** - Finkok firma con los CSD almacenados
3. **Evita errores de sello** - El error CFDI40102 es muy comun con firma local
4. **Funciona igual en demo y produccion**

---

## Arquitectura Recomendada

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Tu Aplicacion  │────>│     Finkok      │────>│       SAT       │
│                 │     │   (sign_stamp)  │     │                 │
│ - Genera XML    │     │ - Genera cadena │     │ - Valida CFDI   │
│ - SIN firma     │     │ - Firma con CSD │     │ - Asigna UUID   │
│                 │     │ - Timbra        │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Flujo con sign_stamp

1. Generar XML **SIN** atributos de firma (sin Sello, Certificado, NoCertificado)
2. Enviar XML a `sign_stamp`
3. Finkok genera cadena original, firma y timbra
4. Recibir XML timbrado con UUID

---

## Configuracion

### Variables de Entorno

```env
# Credenciales de Finkok
FINKOK_USER=tu_usuario
FINKOK_PASSWORD=tu_password

# Ambiente: 'demo' o 'production'
FINKOK_ENVIRONMENT=demo
```

### URLs de Web Services

| Ambiente | URL Base |
|----------|----------|
| Demo | `https://demo-facturacion.finkok.com/servicios/soap/` |
| Produccion | `https://facturacion.finkok.com/servicios/soap/` |

Servicios disponibles:
- `stamp.wsdl` - Timbrado
- `cancel.wsdl` - Cancelacion
- `registration.wsdl` - Registro de RFCs y CSD
- `utilities.wsdl` - Utilidades

---

## Prerrequisitos para Timbrar

Antes de poder timbrar, debes:

### 1. Registrar el RFC en Finkok

```typescript
import { addClient } from './finkok/registration'

await addClient({
  taxpayer_id: 'EKU9003173C9',  // RFC
  type_user: 'O',               // O=OnDemand, P=Prepago
})
```

### 2. Cargar los CSD (Certificado de Sello Digital)

```typescript
import { editClient } from './finkok/registration'

await editClient({
  taxpayer_id: 'EKU9003173C9',
  cer: cerBase64,        // Archivo .cer en Base64
  key: keyBase64,        // Archivo .key en Base64
  passphrase: 'password' // Contrasena de la llave
})
```

### 3. Generar XML sin atributos de firma

El XML para `sign_stamp` NO debe tener:
- `Sello="..."`
- `Certificado="..."`
- `NoCertificado="..."`

---

## RFC y CSD de Pruebas del SAT

Para ambiente de pruebas, usar los certificados oficiales del SAT:

| Campo | Valor |
|-------|-------|
| RFC | `EKU9003173C9` |
| Nombre | `ESCUELA KEMPER URGATE` |
| Regimen Fiscal | `601` |
| Codigo Postal | `21000` |
| Password CSD | `12345678a` |

**IMPORTANTE**: El nombre debe coincidir EXACTAMENTE con el registrado en el SAT.

Descargar certificados de prueba:
- https://www.sat.gob.mx/aplicacion/operacion/97444/descarga-los-archivos-de-pruebas

---

## Errores Comunes y Soluciones

### Error CFDI40102

**Mensaje**: "El resultado de la digestion debe ser igual al resultado de la desencripcion del sello"

**Causa**: La cadena original no coincide con el sello. Generalmente ocurre cuando:
- La libreria de XSLT no procesa correctamente los namespaces XML
- El orden de los campos en la cadena original es incorrecto
- El sello se genero con una cadena diferente

**Solucion**: Usar `sign_stamp` en lugar de firma local. La libreria `xslt-processor` de JavaScript NO funciona correctamente con namespaces XML.

```typescript
// NO HACER (firma local)
const cadena = await generarCadenaOriginalXSLT(xml)  // Falla
const sello = generarSello(cadena, llavePrivada)
const resultado = await stamp(xmlFirmado)

// HACER (sign_stamp)
const xmlSinFirma = generarPreCFDI(datos, { omitirFirma: true })
const resultado = await signStamp(xmlSinFirma)
```

---

### Error 720

**Mensaje**: "El RFC del Emisor no tiene Certificado Activo"

**Causa**: Los CSD no estan cargados en Finkok para ese RFC.

**Solucion**: Cargar los CSD usando `editClient()` o la UI de configuracion.

```typescript
await editClient({
  taxpayer_id: 'RFC_EMISOR',
  cer: cerBase64,
  key: keyBase64,
  passphrase: 'contrasena',
})
```

---

### Error CFDI40138

**Mensaje**: "El campo Nombre del emisor, debe encontrarse en la lista de RFC inscritos no cancelados en el SAT"

**Causa**: El nombre del emisor en el XML no coincide EXACTAMENTE con el registrado en el SAT.

**Solucion**: Verificar y corregir el nombre del emisor.

Ejemplo para RFC de pruebas:
```typescript
// INCORRECTO
nombre: 'ESCUELA KEMPER URGATE SA DE CV'

// CORRECTO
nombre: 'ESCUELA KEMPER URGATE'
```

---

### Error 307

**Mensaje**: "El comprobante no se encuentra timbrado previamente"

**Causa**: Se intento consultar un CFDI con `stamped()` pero no existe.

**Solucion**: Este no es un error, es una respuesta esperada. Usar `stamp()` o `sign_stamp()` para timbrar.

---

### Error 205

**Mensaje**: "El UUID ya fue cancelado previamente"

**Causa**: Se intento cancelar un CFDI que ya esta cancelado.

**Solucion**: Verificar el estado del CFDI antes de cancelar.

---

## Checklist Pre-Produccion

Antes de ir a produccion, verificar:

- [ ] Credenciales de Finkok de produccion configuradas
- [ ] RFC de la empresa registrado en Finkok
- [ ] CSD de produccion cargados en Finkok
- [ ] Nombre del emisor coincide EXACTAMENTE con el SAT
- [ ] Regimen fiscal correcto
- [ ] Codigo postal de expedicion correcto
- [ ] Probado en ambiente demo exitosamente
- [ ] Variables de entorno actualizadas (`FINKOK_ENVIRONMENT=production`)

---

## Estructura de Archivos Recomendada

```
src/lib/cfdi/
├── finkok/
│   ├── client.ts        # Cliente SOAP y utilidades
│   ├── stamp.ts         # Metodos de timbrado (stamp, sign_stamp)
│   ├── cancel.ts        # Metodos de cancelacion
│   ├── registration.ts  # Registro de RFCs y CSD
│   └── csd-utils.ts     # Utilidades para manejo de CSD
├── xml-builder.ts       # Generador de XML CFDI
├── types.ts             # Tipos TypeScript
└── cadena-original.ts   # (No usar con sign_stamp)

src/lib/config/
├── finkok.ts            # Configuracion de Finkok
└── empresa.ts           # Datos del emisor
```

---

## Referencias

- [Finkok Wiki](https://wiki.finkok.com/)
- [SAT - Anexo 20](https://www.sat.gob.mx/consultas/35025/formato-de-factura-electronica-(anexo-20))
- [Certificados de Prueba SAT](https://www.sat.gob.mx/aplicacion/operacion/97444/descarga-los-archivos-de-pruebas)
