'use client'

import { useEffect, useState } from 'react'
import { Modal, Form, Select, InputNumber, Space, Typography, message } from 'antd'
import { useCreatePrecioProducto, useUpdatePrecioProducto, type PrecioConLista } from '@/lib/hooks/usePreciosProductos'
import { useAuth } from '@/lib/hooks/useAuth'

const { Text } = Typography

interface ListaPrecio {
  id: string
  nombre: string
}

interface PrecioProductoModalProps {
  open: boolean
  onClose: () => void
  productoId: string
  precio?: PrecioConLista | null  // null = crear, objeto = editar
  listasDisponibles: ListaPrecio[]
  onSuccess?: () => void
}

export default function PrecioProductoModal({
  open,
  onClose,
  productoId,
  precio,
  listasDisponibles,
  onSuccess,
}: PrecioProductoModalProps) {
  const [form] = Form.useForm()
  const [precioConIva, setPrecioConIva] = useState<number | null>(null)
  const { orgId } = useAuth()

  const createPrecio = useCreatePrecioProducto()
  const updatePrecio = useUpdatePrecioProducto()

  const isEditing = !!precio

  useEffect(() => {
    if (open) {
      if (precio) {
        // Modo edición - cargar valores existentes
        form.setFieldsValue({
          lista_precio_id: precio.lista_precio_id,
          moneda: precio.moneda || 'MXN',
          precio: precio.precio,
        })
        setPrecioConIva(precio.precio_con_iva ?? precio.precio * 1.16)
      } else {
        // Modo crear - resetear form con default MXN
        form.resetFields()
        form.setFieldsValue({ moneda: 'MXN' })
        setPrecioConIva(null)
      }
    }
  }, [open, precio, form])

  const handlePrecioChange = (value: number | null) => {
    if (value !== null && value > 0) {
      setPrecioConIva(Math.round(value * 1.16 * 100) / 100)
    } else {
      setPrecioConIva(null)
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (isEditing && precio) {
        // Actualizar precio existente
        await updatePrecio.mutateAsync({
          id: precio.id,
          producto_id: productoId,
          precio: values.precio,
          precio_con_iva: precioConIva,
          moneda: values.moneda,
        })
        message.success('Precio actualizado correctamente')
      } else {
        // Crear nuevo precio
        await createPrecio.mutateAsync({
          producto_id: productoId,
          lista_precio_id: values.lista_precio_id,
          precio: values.precio,
          precio_con_iva: precioConIva,
          moneda: values.moneda,
          organizacion_id: orgId,
        })
        message.success('Precio creado correctamente')
      }

      onSuccess?.()
      onClose()
    } catch (error: any) {
      if (error.errorFields) {
        // Error de validación del form
        return
      }
      console.error('Error saving precio:', error)
      message.error(error.message || 'Error al guardar precio')
    }
  }

  const isLoading = createPrecio.isPending || updatePrecio.isPending

  // Opciones de lista: en edición usar la lista actual, en crear usar las disponibles
  const listaOptions = isEditing && precio
    ? [{ value: precio.lista_precio_id, label: precio.lista_nombre }]
    : listasDisponibles.map(l => ({ value: l.id, label: l.nombre }))

  return (
    <Modal
      title={isEditing ? 'Editar Precio' : 'Agregar Precio'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEditing ? 'Guardar' : 'Crear'}
      cancelText="Cancelar"
      confirmLoading={isLoading}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
      >
        <Form.Item
          name="lista_precio_id"
          label="Lista de Precios"
          rules={[{ required: true, message: 'Selecciona una lista de precios' }]}
        >
          <Select
            placeholder="Seleccionar lista"
            options={listaOptions}
            disabled={isEditing}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="moneda"
          label="Moneda"
          rules={[{ required: true, message: 'Selecciona la moneda' }]}
        >
          <Select
            options={[
              { value: 'MXN', label: 'Peso Mexicano (MXN)' },
              { value: 'USD', label: 'Dólar Americano (USD)' },
            ]}
          />
        </Form.Item>

        <Form.Item
          name="precio"
          label="Precio (sin IVA)"
          rules={[
            { required: true, message: 'Ingresa el precio' },
            { type: 'number', min: 0.01, message: 'El precio debe ser mayor a 0' },
          ]}
        >
          <InputNumber
            placeholder="0.00"
            style={{ width: '100%' }}
            min={0}
            step={0.01}
            precision={2}
            prefix="$"
            onChange={handlePrecioChange}
          />
        </Form.Item>

        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: '#fafafa',
            borderRadius: 6,
          }}>
            <Text type="secondary">Precio con IVA (16%):</Text>
            <Text strong>
              {precioConIva !== null
                ? new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: form.getFieldValue('moneda') || 'MXN',
                  }).format(precioConIva)
                : '-'}
            </Text>
          </div>
        </Space>
      </Form>
    </Modal>
  )
}
