'use client'

import { Alert, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

/**
 * Componente con el texto borrador de Terminos y Condiciones del servicio
 * ERP CUANTY. Se muestra dentro de un sub-modal desde el modal de detalle
 * de suscripcion. Es PLACEHOLDER hasta que el cliente confirme los T&C
 * oficiales (revisados por abogado / Julio Gonzales).
 */
export default function TerminosCondiciones() {
  return (
    <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 12 }}>
      <Alert
        type="warning"
        showIcon
        message="Borrador pendiente de revision"
        description="Este es un texto provisional. Los terminos y condiciones definitivos los proporcionara el equipo administrador."
        style={{ marginBottom: 16 }}
      />

      <Title level={4} style={{ marginTop: 0 }}>Terminos y Condiciones del Servicio ERP CUANTY</Title>
      <Text type="secondary">Ultima actualizacion: 18 de mayo de 2026</Text>

      <Title level={5}>1. Partes</Title>
      <Paragraph>
        <b>Proveedor:</b> Ing. Julio Gonzales (en lo sucesivo &quot;EL PROVEEDOR&quot;).<br />
        <b>Cliente:</b> SOLAC (RFC MOCD830414SL4), en lo sucesivo &quot;EL CLIENTE&quot;.
      </Paragraph>

      <Title level={5}>2. Objeto del servicio</Title>
      <Paragraph>
        EL PROVEEDOR otorga a EL CLIENTE acceso al Sistema ERP CUANTY, una plataforma de
        gestion empresarial en la nube que incluye modulos de: inventario, clientes,
        cotizaciones, ordenes de venta, facturacion (incluyendo timbrado CFDI 4.0 via PAC),
        compras, punto de venta, reportes y motor de insights.
      </Paragraph>

      <Title level={5}>3. Modalidades y precios</Title>
      <Paragraph>
        <ul>
          <li><b>Plan mensual:</b> $2,500 MXN + IVA por mes, pagaderos el dia 30 de cada mes.</li>
          <li><b>Plan anual:</b> $25,000 MXN + IVA por 12 meses, pagaderos al inicio del periodo.</li>
        </ul>
        Los precios son en pesos mexicanos. EL PROVEEDOR puede ajustar precios con aviso
        previo de 30 dias naturales.
      </Paragraph>

      <Title level={5}>4. Vigencia y renovacion</Title>
      <Paragraph>
        La suscripcion tiene vigencia mensual (o anual segun plan). Se renueva al confirmarse
        el pago dentro del periodo. Si no se recibe pago en la fecha de corte, EL PROVEEDOR
        puede pasar el sistema a <b>modo solo lectura</b> al dia siguiente.
      </Paragraph>

      <Title level={5}>5. Modo solo lectura por falta de pago</Title>
      <Paragraph>
        Bajo este modo: EL CLIENTE conserva acceso para consultar informacion historica;
        se suspenden creacion y edicion de registros, timbrado de CFDI, aplicacion de pagos
        y ajustes de inventario. La reactivacion es inmediata al confirmarse el pago.
      </Paragraph>

      <Title level={5}>6. Forma de pago</Title>
      <Paragraph>
        Transferencia electronica SPEI o deposito bancario a la cuenta indicada por EL PROVEEDOR.
      </Paragraph>

      <Title level={5}>7. Soporte</Title>
      <Paragraph>
        EL PROVEEDOR otorga soporte tecnico durante dias habiles via WhatsApp y correo
        electronico para incidencias del sistema y dudas operativas.
      </Paragraph>

      <Title level={5}>8. Confidencialidad y datos</Title>
      <Paragraph>
        EL PROVEEDOR mantiene la confidencialidad de los datos de EL CLIENTE. Los datos son
        propiedad de EL CLIENTE y pueden ser exportados a solicitud. Si el servicio se cancela,
        EL CLIENTE tiene 30 dias naturales para solicitar exportacion antes de eliminacion.
      </Paragraph>

      <Title level={5}>9. Cancelacion</Title>
      <Paragraph>
        EL CLIENTE puede cancelar con aviso de 30 dias naturales por escrito. No hay reembolsos
        por periodos parciales no usados. EL PROVEEDOR puede cancelar por falta de pago superior
        a 60 dias naturales, previa notificacion.
      </Paragraph>

      <Title level={5}>10. Limitaciones de responsabilidad</Title>
      <Paragraph>
        EL PROVEEDOR no se hace responsable por interrupciones causadas por terceros (Vercel,
        Supabase, Finkok, proveedor de internet del cliente). La responsabilidad maxima de
        EL PROVEEDOR se limita al monto pagado por EL CLIENTE en los ultimos 3 meses.
      </Paragraph>

      <Title level={5}>11. Jurisdiccion</Title>
      <Paragraph>
        Para resolucion de controversias, las partes se someten a las leyes y tribunales de
        Tonala, Jalisco, Mexico.
      </Paragraph>

      <Title level={5}>12. Aceptacion</Title>
      <Paragraph>
        El uso continuo del sistema implica aceptacion de estos terminos.
      </Paragraph>
    </div>
  )
}
