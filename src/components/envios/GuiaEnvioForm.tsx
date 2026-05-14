'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Form, Input, InputNumber, Select, DatePicker, Button, Card, Row, Col,
  Space, Typography, Divider, message, Tag, AutoComplete
} from 'antd'
import { SaveOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  useUpsertGuiaEnvio, buildTrackingUrl,
  PAQUETERIA_LABELS, STATUS_LABELS,
  type GuiaEnvio, type GuiaPaqueteria, type GuiaStatus,
  type GuiaTipoEntrega, type GuiaFormaPago, type UpsertGuiaInput,
} from '@/lib/hooks/queries/useGuiasEnvio'

const { Text, Title } = Typography
const { TextArea } = Input

interface OvOption {
  id: string
  folio: string
  status: string
  total: number
  cliente_id: string | null
  cliente_nombre: string | null
}

interface ClienteOption {
  id: string
  nombre_comercial: string
}

interface GuiaEnvioFormProps {
  initialData?: GuiaEnvio
  initialCotizacionesIds?: string[]
  /** Pre-selecciona una cotizacion (cuando se crea la guia desde la pagina de OV) */
  prefilledCotizacionId?: string
  onCancel?: () => void
}

export default function GuiaEnvioForm({
  initialData,
  initialCotizacionesIds = [],
  prefilledCotizacionId,
  onCancel,
}: GuiaEnvioFormProps) {
  const router = useRouter()
  const [form] = Form.useForm()
  const { orgId } = useAuth()
  const upsert = useUpsertGuiaEnvio()

  const [ovs, setOvs] = useState<OvOption[]>([])
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedCotIds, setSelectedCotIds] = useState<string[]>(
    initialCotizacionesIds.length ? initialCotizacionesIds
      : (prefilledCotizacionId ? [prefilledCotizacionId] : [])
  )

  // Cargar OVs ya facturadas + clientes.
  // Solo se ligan nuevas guias a OVs facturadas. Pero si una guia existente
  // ya estaba ligada a OVs en otro estado, las traemos tambien para que el
  // SELECT las muestre como seleccionadas (no perder referencia historica).
  useEffect(() => {
    if (!orgId) return
    const supabase = getSupabaseClient()
    const idsHistoricas = initialCotizacionesIds.length > 0 ? initialCotizacionesIds : []
    const queryFacturadas = supabase.schema('erp').from('cotizaciones')
      .select('id, folio, status, total, cliente_id, clientes:cliente_id (nombre_comercial)')
      .eq('organizacion_id', orgId)
      .eq('status', 'facturada')
      .order('created_at', { ascending: false })
      .limit(200)
    const queryHistoricas = idsHistoricas.length > 0
      ? supabase.schema('erp').from('cotizaciones')
          .select('id, folio, status, total, cliente_id, clientes:cliente_id (nombre_comercial)')
          .in('id', idsHistoricas)
      : Promise.resolve({ data: [] as unknown[] })
    Promise.all([
      queryFacturadas,
      queryHistoricas,
      supabase.schema('erp').from('clientes')
        .select('id, nombre_comercial')
        .eq('organizacion_id', orgId)
        .eq('is_active', true)
        .order('nombre_comercial')
        .limit(500),
    ]).then(([ovRes, ovHistRes, clRes]) => {
      const mapearOv = (r: unknown): OvOption => {
        const row = r as { id: string; folio: string; status: string; total: number; cliente_id: string | null; clientes: { nombre_comercial: string | null } | null }
        return {
          id: row.id,
          folio: row.folio,
          status: row.status,
          total: row.total,
          cliente_id: row.cliente_id,
          cliente_nombre: row.clientes?.nombre_comercial ?? null,
        }
      }
      const facturadas = (ovRes.data ?? []).map(mapearOv)
      const historicas = (ovHistRes.data ?? []).map(mapearOv)
      // Mergear sin duplicar (las historicas ya facturadas pueden venir en ambas)
      const idsFacturadas = new Set(facturadas.map(o => o.id))
      const ovList: OvOption[] = [
        ...facturadas,
        ...historicas.filter(o => !idsFacturadas.has(o.id)),
      ]
      setOvs(ovList)
      setClientes(clRes.data ?? [])
      setLoadingData(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  // Auto-rellenar campos al cambiar OV seleccionada (o cliente)
  useEffect(() => {
    if (initialData) return // no auto-llenar en modo edit
    if (selectedCotIds.length === 0) return

    const supabase = getSupabaseClient()
    const primeraOv = ovs.find(o => o.id === selectedCotIds[0])
    if (!primeraOv?.cliente_id) return

    // jalar el monto cobrado (suma de items SER-ENV de las OVs seleccionadas)
    Promise.all([
      supabase.schema('erp').from('cotizacion_items')
        .select('subtotal, productos:producto_id (sku)')
        .in('cotizacion_id', selectedCotIds),
    ]).then(([itemsRes]) => {
      const items = itemsRes.data ?? []
      const totalEnvio = items
        .filter((i: unknown) => {
          const r = i as { productos: { sku: string | null } | null }
          return r.productos?.sku === 'SER-ENV'
        })
        .reduce((acc, i: unknown) => acc + Number((i as { subtotal: number }).subtotal ?? 0), 0)

      // Auto-pre-fill cliente y monto si están vacios
      if (!form.getFieldValue('cliente_id')) {
        form.setFieldsValue({ cliente_id: primeraOv.cliente_id })
      }
      if (!form.getFieldValue('monto_cobrado') && totalEnvio > 0) {
        form.setFieldsValue({ monto_cobrado: totalEnvio })
      }
    })
  }, [selectedCotIds, ovs, form, initialData])

  // Initial values
  const initialValues = useMemo(() => {
    if (initialData) {
      return {
        cliente_id: initialData.cliente_id,
        cliente_nombre_libre: initialData.cliente_nombre_libre,
        paqueteria: initialData.paqueteria,
        numero_guia: initialData.numero_guia,
        referencia_externa: initialData.referencia_externa,
        tipo_entrega: initialData.tipo_entrega,
        forma_pago_envio: initialData.forma_pago_envio,
        atencion_a: initialData.atencion_a,
        destino_ciudad: initialData.destino_ciudad,
        destino_estado: initialData.destino_estado,
        destino_cp: initialData.destino_cp,
        peso_kg: initialData.peso_kg,
        ancho: initialData.medidas_cm?.ancho,
        alto: initialData.medidas_cm?.alto,
        largo: initialData.medidas_cm?.largo,
        bultos: initialData.bultos,
        valor_declarado: initialData.valor_declarado,
        costo_real: initialData.costo_real,
        monto_cobrado: initialData.monto_cobrado,
        status: initialData.status,
        fecha_despacho: initialData.fecha_despacho ? dayjs(initialData.fecha_despacho) : dayjs(),
        fecha_estimada: initialData.fecha_estimada ? dayjs(initialData.fecha_estimada) : null,
        fecha_entrega: initialData.fecha_entrega ? dayjs(initialData.fecha_entrega) : null,
        enviado_a_cliente_por: initialData.enviado_a_cliente_por,
        notas: initialData.notas,
      }
    }
    return {
      paqueteria: 'paquetexpress' as GuiaPaqueteria,
      tipo_entrega: 'domicilio' as GuiaTipoEntrega,
      forma_pago_envio: 'pagado' as GuiaFormaPago,
      bultos: 1,
      status: 'en_paqueteria' as GuiaStatus,
      fecha_despacho: dayjs(),
    }
  }, [initialData])

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields()
      const payload: UpsertGuiaInput = {
        id: initialData?.id,
        cliente_id: v.cliente_id ?? null,
        cliente_nombre_libre: v.cliente_nombre_libre ?? null,
        paqueteria: v.paqueteria,
        numero_guia: v.numero_guia ?? null,
        referencia_externa: v.referencia_externa ?? null,
        tipo_entrega: v.tipo_entrega,
        forma_pago_envio: v.forma_pago_envio,
        atencion_a: v.atencion_a ?? null,
        destino_ciudad: v.destino_ciudad ?? null,
        destino_estado: v.destino_estado ?? null,
        destino_cp: v.destino_cp ?? null,
        peso_kg: v.peso_kg ?? null,
        medidas_cm: (v.ancho || v.alto || v.largo)
          ? { ancho: v.ancho ?? undefined, alto: v.alto ?? undefined, largo: v.largo ?? undefined }
          : null,
        bultos: v.bultos ?? 1,
        valor_declarado: v.valor_declarado ?? null,
        costo_real: v.costo_real ?? null,
        monto_cobrado: v.monto_cobrado ?? null,
        status: v.status,
        fecha_despacho: v.fecha_despacho ? (v.fecha_despacho as Dayjs).toISOString() : null,
        fecha_estimada: v.fecha_estimada ? (v.fecha_estimada as Dayjs).format('YYYY-MM-DD') : null,
        fecha_entrega: v.fecha_entrega ? (v.fecha_entrega as Dayjs).toISOString() : null,
        enviado_a_cliente_por: v.enviado_a_cliente_por ?? null,
        notas: v.notas ?? null,
        cotizaciones_ids: selectedCotIds,
      }
      const { id } = await upsert.mutateAsync(payload)
      message.success(initialData ? 'Guía actualizada' : 'Guía creada')
      router.push(`/envios/${id}`)
    } catch (err: unknown) {
      const errAny = err as { errorFields?: unknown; message?: string }
      if (errAny.errorFields) return
      message.error(errAny.message || 'Error al guardar')
    }
  }

  const numero = Form.useWatch('numero_guia', form) as string | undefined
  const paqueteria = Form.useWatch('paqueteria', form) as GuiaPaqueteria | undefined
  const trackingUrl = paqueteria && numero ? buildTrackingUrl(paqueteria, numero) : null

  return (
    <Form form={form} layout="vertical" initialValues={initialValues}>
      {/* Vinculacion con OVs */}
      <Card title="Órdenes de venta vinculadas" style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Selecciona una o varias OVs <strong>ya facturadas</strong> cuyo material se envía en esta guía. Si son varias del mismo cliente, se consolidan. Los montos mostrados son el total con IVA.
        </Text>
        <Select
          mode="multiple"
          loading={loadingData}
          value={selectedCotIds}
          onChange={setSelectedCotIds}
          placeholder="Selecciona OV(s) facturada(s)…"
          style={{ width: '100%' }}
          showSearch
          optionFilterProp="label"
          options={ovs.map(o => ({
            value: o.id,
            label: `${o.folio} — ${o.cliente_nombre || 'Sin cliente'} — Total c/IVA $${o.total.toFixed(2)} [${o.status}]`,
          }))}
        />
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Cliente y destino" style={{ marginBottom: 16 }}>
            <Form.Item name="cliente_id" label="Cliente del catálogo (opcional)">
              <Select
                showSearch allowClear
                placeholder="Buscar cliente…"
                optionFilterProp="label"
                options={clientes.map(c => ({ value: c.id, label: c.nombre_comercial }))}
              />
            </Form.Item>
            <Form.Item name="cliente_nombre_libre" label="Destinatario libre (si no está en catálogo)">
              <Input placeholder="ej. Distribuidora de Gas Noel" />
            </Form.Item>
            <Form.Item name="atencion_a" label="Atención">
              <Input placeholder="ej. Ing. Juan Pérez" />
            </Form.Item>
            <Row gutter={8}>
              <Col span={10}><Form.Item name="destino_ciudad" label="Ciudad"><Input placeholder="Pedro Escobedo" /></Form.Item></Col>
              <Col span={8}><Form.Item name="destino_estado" label="Estado"><Input placeholder="Querétaro" /></Form.Item></Col>
              <Col span={6}><Form.Item name="destino_cp" label="CP"><Input maxLength={5} placeholder="76700" /></Form.Item></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Paquetería y tracking" style={{ marginBottom: 16 }}>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item name="paqueteria" label="Paquetería" rules={[{ required: true }]}>
                  <Select options={Object.entries(PAQUETERIA_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="numero_guia" label="Número de guía">
                  <Input placeholder="ej. 1112403O2090" />
                </Form.Item>
              </Col>
            </Row>
            {trackingUrl && (
              <div style={{ marginBottom: 12 }}>
                <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                  <LinkOutlined /> Rastrear este número en el courier
                </a>
              </div>
            )}
            <Form.Item name="referencia_externa" label="Referencia externa (opcional)">
              <Input placeholder="ej. GDL04AB0049630 (Solicitud de servicio del courier)" />
            </Form.Item>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item name="tipo_entrega" label="Tipo de entrega" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'domicilio', label: 'A domicilio' },
                    { value: 'ocurre', label: 'Ocurre (recoge en sucursal)' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="forma_pago_envio" label="Forma de pago" rules={[{ required: true }]}>
                  <Select options={[
                    { value: 'pagado', label: 'Pagado (SOLAC paga)' },
                    { value: 'por_cobrar', label: 'Por cobrar (cliente paga al recibir)' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Paquete" style={{ marginBottom: 16 }}>
            <Row gutter={8}>
              <Col span={8}><Form.Item name="peso_kg" label="Peso (kg)"><InputNumber style={{ width: '100%' }} step={0.01} min={0} /></Form.Item></Col>
              <Col span={8}><Form.Item name="bultos" label="Bultos"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
              <Col span={8}><Form.Item name="valor_declarado" label="Valor declarado ($)"><InputNumber style={{ width: '100%' }} prefix="$" /></Form.Item></Col>
            </Row>
            <Text type="secondary" style={{ fontSize: 12 }}>Medidas (cm)</Text>
            <Row gutter={8} style={{ marginTop: 4 }}>
              <Col span={8}><Form.Item name="ancho" label="Ancho"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              <Col span={8}><Form.Item name="alto" label="Alto"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
              <Col span={8}><Form.Item name="largo" label="Largo"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Costos" style={{ marginBottom: 16 }}>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item name="costo_real" label="Costo real (lo que SOLAC pagó)" extra="Del ticket del courier">
                  <InputNumber style={{ width: '100%' }} prefix="$" precision={2} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="monto_cobrado" label="Monto cobrado al cliente" extra="Auto-jalado del SER-ENV en la OV">
                  <InputNumber style={{ width: '100%' }} prefix="$" precision={2} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card title="Status y fechas" style={{ marginBottom: 16 }}>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            </Form.Item>
            <Row gutter={8}>
              <Col span={8}><Form.Item name="fecha_despacho" label="Despacho"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item></Col>
              <Col span={8}><Form.Item name="fecha_estimada" label="Estimada"><DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" /></Form.Item></Col>
              <Col span={8}><Form.Item name="fecha_entrega" label="Entrega"><DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" /></Form.Item></Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Comunicación al cliente" style={{ marginBottom: 16 }}>
            <Form.Item name="enviado_a_cliente_por" label="¿Cómo se compartió la guía al cliente?">
              <Select allowClear options={[
                { value: 'no_enviado', label: 'No enviado aún' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'email', label: 'Email' },
                { value: 'manual', label: 'Manual / otro' },
              ]} />
            </Form.Item>
            <Form.Item name="notas" label="Notas">
              <TextArea rows={3} placeholder="Comentarios, incidencia, observaciones…" />
            </Form.Item>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Space>
        <Button type="primary" icon={<SaveOutlined />} loading={upsert.isPending} onClick={handleSubmit}>
          {initialData ? 'Guardar cambios' : 'Crear guía'}
        </Button>
        <Button icon={<CloseOutlined />} onClick={onCancel ?? (() => router.back())}>
          Cancelar
        </Button>
      </Space>
    </Form>
  )
}
