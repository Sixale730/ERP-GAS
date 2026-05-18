'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Tabs,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  Space,
  Typography,
  DatePicker,
  message,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Spin,
  Divider,
  Alert,
  Radio,
} from 'antd'
import {
  SaveOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  TeamOutlined,
  EyeOutlined,
  LockOutlined,
  HistoryOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  useSuscripcionPublica,
  useHistorialPagosSuscripcion,
  useEventosSuscripcion,
  useActualizarConfigSuscripcion,
  useRegistrarPagoSuscripcion,
} from '@/lib/hooks/queries/useSuscripcion'
import { getSupabaseClient } from '@/lib/supabase/client'
import { formatFechaLarga, formatMonto, SEMAFORO_COLORS } from '@/lib/utils/suscripcion'
import type {
  ModoLecturaBloqueos,
  SuscripcionAudienciaModo,
  SuscripcionPago,
  SuscripcionEvento,
} from '@/types/suscripciones'

const { Title, Text } = Typography

interface UsuarioOrg {
  id: string
  nombre: string
  email: string
  rol: string
}

export default function SuscripcionesPage() {
  const router = useRouter()
  const { role, organizacion } = useAuth()

  // Gate super_admin (defensa en profundidad — el middleware ya redirige)
  useEffect(() => {
    if (role && role !== 'super_admin') router.replace('/dashboard')
  }, [role, router])

  const { data: susc, isLoading } = useSuscripcionPublica(role === 'super_admin')
  const { data: pagos = [] } = useHistorialPagosSuscripcion(role === 'super_admin')
  const [diasActividad, setDiasActividad] = useState(30)
  const { data: eventos = [] } = useEventosSuscripcion(diasActividad, role === 'super_admin')

  const actualizarConfig = useActualizarConfigSuscripcion()
  const registrarPago = useRegistrarPagoSuscripcion()

  // Usuarios de la organizacion (para multi-select de audiencia)
  const [usuariosOrg, setUsuariosOrg] = useState<UsuarioOrg[]>([])
  useEffect(() => {
    if (!organizacion?.id) return
    const fetchUsuarios = async () => {
      const supabase = getSupabaseClient()
      const { data } = await supabase
        .schema('erp')
        .from('usuarios')
        .select('id, nombre, email, rol')
        .eq('organizacion_id', organizacion.id)
        .eq('is_active', true)
        .order('nombre')
      setUsuariosOrg((data as UsuarioOrg[] | null) ?? [])
    }
    fetchUsuarios()
  }, [organizacion?.id])

  if (role !== 'super_admin' || isLoading || !susc) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      <Title level={2} style={{ marginTop: 0 }}>
        <CreditCardOutlined /> Suscripciones del Sistema
      </Title>
      <Text type="secondary">
        Configura la suscripcion del ERP CUANTY, registra pagos, controla la visibilidad del banner
        y revisa la actividad de los usuarios.
      </Text>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'general',
            label: <span><EyeOutlined /> General</span>,
            children: <TabGeneral susc={susc} usuariosOrg={usuariosOrg} actualizarConfig={actualizarConfig} />,
          },
          {
            key: 'plan',
            label: <span><DollarOutlined /> Plan y Pagos</span>,
            children: <TabPlan susc={susc} pagos={pagos} registrarPago={registrarPago} actualizarConfig={actualizarConfig} />,
          },
          {
            key: 'modo-lectura',
            label: <span><LockOutlined /> Modo Lectura</span>,
            children: <TabModoLectura susc={susc} actualizarConfig={actualizarConfig} />,
          },
          {
            key: 'actividad',
            label: <span><HistoryOutlined /> Actividad</span>,
            children: <TabActividad eventos={eventos} dias={diasActividad} setDias={setDiasActividad} />,
          },
        ]}
      />
    </div>
  )
}

// ─── Tab General ────────────────────────────────────────────────────────────

function TabGeneral({
  susc,
  usuariosOrg,
  actualizarConfig,
}: {
  susc: ReturnType<typeof useSuscripcionPublica>['data'] extends infer T | null | undefined ? NonNullable<T> : never
  usuariosOrg: UsuarioOrg[]
  actualizarConfig: ReturnType<typeof useActualizarConfigSuscripcion>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      banner_activo: susc.banner_activo,
      banner_audiencia_modo: susc.banner_audiencia_modo,
      banner_usuarios_visibles: susc.banner_usuarios_visibles ?? [],
      banner_forzar: susc.banner_forzar,
      dias_alerta: susc.dias_alerta,
      contacto_nombre: susc.contacto_nombre,
      contacto_whatsapp: susc.contacto_whatsapp,
      fecha_corte: dayjs(susc.fecha_corte),
    })
  }, [susc, form])

  const sem = SEMAFORO_COLORS[
    susc.dias_restantes <= 1 ? 'rojo' :
    susc.dias_restantes <= 2 ? 'naranja' :
    susc.dias_restantes <= susc.dias_alerta ? 'amarillo' : 'verde'
  ]

  const audienciaModo = Form.useWatch('banner_audiencia_modo', form) as SuscripcionAudienciaModo
  const bannerActivo = Form.useWatch('banner_activo', form) as boolean

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await actualizarConfig.mutateAsync({
        banner_activo: values.banner_activo,
        banner_audiencia_modo: values.banner_audiencia_modo,
        banner_usuarios_visibles: values.banner_usuarios_visibles ?? [],
        banner_forzar: values.banner_forzar,
        dias_alerta: values.dias_alerta,
        contacto_nombre: values.contacto_nombre,
        contacto_whatsapp: values.contacto_whatsapp,
        fecha_corte: values.fecha_corte ? values.fecha_corte.format('YYYY-MM-DD') : undefined,
      })
      message.success('Configuracion guardada')
    } catch (err: any) {
      message.error(err?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ background: sem.bg, borderColor: sem.border }}>
            <Statistic
              title="Dias restantes"
              value={Math.max(susc.dias_restantes, 0)}
              valueStyle={{ color: sem.text }}
              prefix={<span>{sem.icon}</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Fecha de corte"
              value={formatFechaLarga(susc.fecha_corte)}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small">
            <Statistic
              title="Estado"
              value={susc.estado.toUpperCase()}
              valueStyle={{ fontSize: 18, color: susc.estado === 'activa' ? '#389e0d' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Form form={form} layout="vertical">
        <Divider orientation="left">Banner del dashboard</Divider>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="El banner esta apagado por default."
          description="Activalo cuando quieras que el equipo SOLAC lo vea. Puedes mostrarlo a TODOS o solo a usuarios seleccionados para hacer pruebas internas primero."
        />

        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item label="Banner activo" name="banner_activo" valuePropName="checked">
              <Switch checkedChildren="Activo" unCheckedChildren="Apagado" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Forzar visibilidad (ignorar dias de alerta)"
              name="banner_forzar"
              valuePropName="checked"
              tooltip="Si esta activo, el banner se muestra siempre que la suscripcion no este al corriente. Si esta apagado, solo aparece N dias antes del corte segun 'dias de alerta'."
            >
              <Switch checkedChildren="Siempre" unCheckedChildren="Solo cerca del corte" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Audiencia del banner"
              name="banner_audiencia_modo"
              tooltip="Controla quien puede ver el banner. 'Seleccionados' es util para hacer preview interno antes de mostrarlo al equipo."
            >
              <Radio.Group disabled={!bannerActivo}>
                <Radio.Button value="todos">Todos los usuarios</Radio.Button>
                <Radio.Button value="seleccionados">Solo seleccionados</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              label="Dias antes del corte para aparecer (si no esta forzado)"
              name="dias_alerta"
              tooltip="Cuando 'Forzar visibilidad' esta apagado, el banner solo aparece estos N dias antes del corte."
            >
              <InputNumber min={1} max={30} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {bannerActivo && audienciaModo === 'seleccionados' && (
          <Form.Item
            label="Usuarios que pueden ver el banner"
            name="banner_usuarios_visibles"
            extra="Solo estos usuarios veran el banner. Si esta vacio, NADIE lo vera."
          >
            <Select
              mode="multiple"
              placeholder="Selecciona usuarios..."
              options={usuariosOrg.map((u) => ({
                value: u.id,
                label: `${u.nombre} (${u.email}) — ${u.rol}`,
              }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        )}

        <Divider orientation="left">Fecha y contacto</Divider>

        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8}>
            <Form.Item label="Proxima fecha de corte" name="fecha_corte">
              <DatePicker format="DD-MMM-YYYY" style={{ width: '100%' }} prefix={<CalendarOutlined />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              label="Nombre del administrador"
              name="contacto_nombre"
              rules={[{ required: true, message: 'Requerido' }]}
            >
              <Input prefix={<TeamOutlined />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              label="WhatsApp del administrador"
              name="contacto_whatsapp"
              rules={[{ required: true, message: 'Requerido' }]}
              extra="Formato +52 1 33 ... (se limpia automaticamente para el link)"
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          Guardar configuracion
        </Button>
      </Form>
    </Card>
  )
}

// ─── Tab Plan ───────────────────────────────────────────────────────────────

function TabPlan({
  susc,
  pagos,
  registrarPago,
  actualizarConfig,
}: {
  susc: NonNullable<ReturnType<typeof useSuscripcionPublica>['data']>
  pagos: SuscripcionPago[]
  registrarPago: ReturnType<typeof useRegistrarPagoSuscripcion>
  actualizarConfig: ReturnType<typeof useActualizarConfigSuscripcion>
}) {
  const [formPlan] = Form.useForm()
  const [formPago] = Form.useForm()
  const [savingPlan, setSavingPlan] = useState(false)
  const [savingPago, setSavingPago] = useState(false)

  useEffect(() => {
    formPlan.setFieldsValue({
      plan: susc.plan,
      monto_mensual: susc.monto_mensual,
      monto_anual: susc.monto_anual,
      iva_porcentaje: susc.iva_porcentaje,
    })
    formPago.setFieldsValue({
      fecha_pago: dayjs(),
      monto: susc.plan === 'anual' ? susc.monto_anual : susc.monto_mensual,
      forma_pago: 'transferencia',
      periodo_meses: susc.plan === 'anual' ? 12 : 1,
    })
  }, [susc, formPlan, formPago])

  const handleGuardarPlan = async () => {
    try {
      const v = await formPlan.validateFields()
      setSavingPlan(true)
      await actualizarConfig.mutateAsync({
        plan: v.plan,
        monto_mensual: v.monto_mensual,
        monto_anual: v.monto_anual,
        iva_porcentaje: v.iva_porcentaje,
      })
      message.success('Plan actualizado')
    } catch (err: any) {
      message.error(err?.message ?? 'Error')
    } finally {
      setSavingPlan(false)
    }
  }

  const handleRegistrarPago = async () => {
    try {
      const v = await formPago.validateFields()
      setSavingPago(true)
      await registrarPago.mutateAsync({
        monto: v.monto,
        fecha_pago: v.fecha_pago.format('YYYY-MM-DD'),
        forma_pago: v.forma_pago,
        referencia: v.referencia ?? null,
        periodo_meses: v.periodo_meses ?? 1,
        comprobante_url: v.comprobante_url ?? null,
        notas: v.notas ?? null,
      })
      message.success('Pago registrado. Banner desaparecera y fecha de corte avanzo.')
      formPago.resetFields(['referencia', 'comprobante_url', 'notas'])
    } catch (err: any) {
      message.error(err?.message ?? 'Error al registrar pago')
    } finally {
      setSavingPago(false)
    }
  }

  const columnsPagos: ColumnsType<SuscripcionPago> = [
    { title: 'Fecha', dataIndex: 'fecha_pago', width: 110, render: (v: string) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Monto', dataIndex: 'monto', width: 110, align: 'right', render: (v: number) => formatMonto(v) },
    { title: 'Forma', dataIndex: 'forma_pago', width: 130 },
    { title: 'Referencia', dataIndex: 'referencia', ellipsis: true },
    {
      title: 'Periodo cubierto',
      key: 'periodo',
      width: 200,
      render: (_, r) => `${dayjs(r.periodo_cubierto_desde).format('DD-MMM')} → ${dayjs(r.periodo_cubierto_hasta).format('DD-MMM-YYYY')}`,
    },
    { title: 'Registrado por', dataIndex: 'registrado_por_nombre', width: 150, ellipsis: true },
  ]

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card title="Plan y montos">
          <Form form={formPlan} layout="vertical">
            <Form.Item label="Plan vigente" name="plan">
              <Select
                options={[
                  { value: 'mensual', label: 'Mensual' },
                  { value: 'anual', label: 'Anual' },
                ]}
              />
            </Form.Item>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item label="Monto mensual (sin IVA)" name="monto_mensual">
                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="$" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Monto anual (sin IVA)" name="monto_anual">
                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="$" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="IVA (%)" name="iva_porcentaje">
              <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
            </Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleGuardarPlan} loading={savingPlan}>
              Guardar plan
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title="Registrar pago">
          <Form form={formPago} layout="vertical">
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item label="Fecha del pago" name="fecha_pago" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Monto" name="monto" rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="$" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={8}>
              <Col span={12}>
                <Form.Item label="Forma de pago" name="forma_pago" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: 'transferencia', label: 'Transferencia / SPEI' },
                      { value: 'efectivo', label: 'Efectivo' },
                      { value: 'tarjeta', label: 'Tarjeta' },
                      { value: 'otro', label: 'Otro' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Periodo cubierto (meses)"
                  name="periodo_meses"
                  rules={[{ required: true }]}
                  extra="1 = mensual, 12 = anual"
                >
                  <InputNumber min={1} max={36} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Referencia" name="referencia">
              <Input placeholder="Folio bancario / referencia" />
            </Form.Item>
            <Form.Item label="URL del comprobante (opcional)" name="comprobante_url">
              <Input placeholder="https://..." />
            </Form.Item>
            <Form.Item label="Notas" name="notas">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button type="primary" icon={<DollarOutlined />} onClick={handleRegistrarPago} loading={savingPago}>
              Registrar pago y renovar
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="Historial de pagos">
          <Table
            dataSource={pagos}
            columns={columnsPagos}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 900 }}
            locale={{ emptyText: 'Aun no hay pagos registrados.' }}
          />
        </Card>
      </Col>
    </Row>
  )
}

// ─── Tab Modo lectura ───────────────────────────────────────────────────────

function TabModoLectura({
  susc,
  actualizarConfig,
}: {
  susc: NonNullable<ReturnType<typeof useSuscripcionPublica>['data']>
  actualizarConfig: ReturnType<typeof useActualizarConfigSuscripcion>
}) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    form.setFieldsValue({
      modo_lectura_activo: susc.modo_lectura_activo,
      ...susc.modo_lectura_bloqueos,
    })
  }, [susc, form])

  const activo = Form.useWatch('modo_lectura_activo', form) as boolean

  const handleSave = async () => {
    try {
      const v = await form.validateFields()
      setSaving(true)
      const bloqueos: ModoLecturaBloqueos = {
        crear: !!v.crear,
        editar: !!v.editar,
        timbrar: !!v.timbrar,
        pagos: !!v.pagos,
        ajustes: !!v.ajustes,
        descargar_pdf: !!v.descargar_pdf,
        exportar_excel: !!v.exportar_excel,
        config: !!v.config,
      }
      await actualizarConfig.mutateAsync({
        modo_lectura_activo: !!v.modo_lectura_activo,
        modo_lectura_bloqueos: bloqueos,
      })
      message.success('Modo lectura actualizado')
    } catch (err: any) {
      message.error(err?.message ?? 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Estructura preparada, todavia inactiva en el codigo"
        description="Los toggles guardan configuracion, pero los puntos de mutacion del ERP aun NO consultan estos flags. Cuando este listo, los bloqueos se aplicaran segun esta configuracion. super_admin siempre queda exento."
      />

      <Form form={form} layout="vertical">
        <Form.Item
          label="Modo solo lectura activo"
          name="modo_lectura_activo"
          valuePropName="checked"
        >
          <Switch checkedChildren="Activo" unCheckedChildren="Apagado" />
        </Form.Item>

        <Divider orientation="left">Que bloquear cuando este activo</Divider>

        <Row gutter={[16, 0]}>
          {(
            [
              ['crear', 'Crear nuevos registros (clientes, productos, etc.)'],
              ['editar', 'Editar registros existentes'],
              ['timbrar', 'Timbrado de CFDI (Finkok)'],
              ['pagos', 'Aplicar pagos a facturas'],
              ['ajustes', 'Ajustes de inventario'],
              ['descargar_pdf', 'Descarga de PDFs'],
              ['exportar_excel', 'Exportacion de reportes Excel'],
              ['config', 'Acceso a configuracion general'],
            ] as const
          ).map(([key, label]) => (
            <Col xs={24} sm={12} key={key}>
              <Form.Item label={label} name={key} valuePropName="checked">
                <Switch disabled={!activo} />
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
          Guardar configuracion de modo lectura
        </Button>
      </Form>
    </Card>
  )
}

// ─── Tab Actividad ──────────────────────────────────────────────────────────

function TabActividad({
  eventos,
  dias,
  setDias,
}: {
  eventos: SuscripcionEvento[]
  dias: number
  setDias: (n: number) => void
}) {
  const resumen = useMemo(() => {
    const r: Record<string, number> = {}
    eventos.forEach((e) => { r[e.evento] = (r[e.evento] ?? 0) + 1 })
    return r
  }, [eventos])

  const usuariosUnicos = useMemo(() => {
    const s = new Set<string>()
    eventos.forEach((e) => { if (e.usuario_email) s.add(e.usuario_email) })
    return s.size
  }, [eventos])

  const columns: ColumnsType<SuscripcionEvento> = [
    { title: 'Fecha', dataIndex: 'created_at', width: 160, render: (v: string) => dayjs(v).format('DD-MMM HH:mm') },
    { title: 'Usuario', dataIndex: 'usuario_nombre', width: 180, ellipsis: true },
    { title: 'Email', dataIndex: 'usuario_email', width: 220, ellipsis: true },
    { title: 'Rol', dataIndex: 'usuario_rol', width: 110, render: (v: string) => v && <Tag>{v}</Tag> },
    {
      title: 'Evento',
      dataIndex: 'evento',
      width: 180,
      render: (v: string) => {
        const colors: Record<string, string> = {
          banner_visto: 'blue',
          modal_abierto: 'cyan',
          terminos_abiertos: 'purple',
          whatsapp_click: 'green',
          plan_anual_visto: 'gold',
          pago_registrado: 'lime',
          config_modificada: 'orange',
        }
        return <Tag color={colors[v] ?? 'default'}>{v}</Tag>
      },
    },
    { title: 'IP', dataIndex: 'ip', width: 130, render: (v: string | null) => v ?? '—' },
  ]

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Statistic title="Total eventos" value={eventos.length} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Usuarios distintos" value={usuariosUnicos} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Banner visto" value={resumen['banner_visto'] ?? 0} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="WhatsApp clicks" value={resumen['whatsapp_click'] ?? 0} />
          </Col>
        </Row>

        <Space>
          <Text>Mostrar ultimos:</Text>
          <Select
            value={dias}
            onChange={setDias}
            options={[
              { value: 7, label: '7 dias' },
              { value: 15, label: '15 dias' },
              { value: 30, label: '30 dias' },
              { value: 60, label: '60 dias' },
              { value: 90, label: '90 dias' },
            ]}
            style={{ width: 120 }}
          />
        </Space>

        <Table
          dataSource={eventos}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: 'Sin eventos en el periodo seleccionado.' }}
        />
      </Space>
    </Card>
  )
}
