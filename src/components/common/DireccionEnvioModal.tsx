'use client'

import { useEffect, useState } from 'react'
import { Modal, Form, Input, Row, Col, Checkbox, AutoComplete, message } from 'antd'
import type { DireccionEnvio, DireccionEnvioInsert, DireccionEnvioUpdate } from '@/types/database'
import { ESTADOS_MEXICO, getCiudadesByEstado, esEstadoMexico } from '@/lib/config/mexico'
import { useCreateDireccionEnvio, useUpdateDireccionEnvio } from '@/lib/hooks/useDireccionesEnvio'
import { useAuth } from '@/lib/hooks/useAuth'

const { TextArea } = Input

interface DireccionEnvioModalProps {
  open: boolean
  onClose: () => void
  clienteId: string
  direccion?: DireccionEnvio | null // If provided, edit mode
  onSuccess?: (direccion: DireccionEnvio) => void
}

export default function DireccionEnvioModal({
  open,
  onClose,
  clienteId,
  direccion,
  onSuccess,
}: DireccionEnvioModalProps) {
  const [form] = Form.useForm()
  const isEditing = !!direccion

  const { orgId } = useAuth()
  const createMutation = useCreateDireccionEnvio()
  const updateMutation = useUpdateDireccionEnvio()

  // Estado autocomplete
  const [estadoSearch, setEstadoSearch] = useState('')
  const [estadoOptions, setEstadoOptions] = useState<{ value: string; label: string }[]>([])

  // Ciudad autocomplete
  const [ciudadSearch, setCiudadSearch] = useState('')
  const [ciudadOptions, setCiudadOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    if (open) {
      if (direccion) {
        form.setFieldsValue({
          alias: direccion.alias,
          calle: direccion.calle,
          numero_exterior: direccion.numero_exterior,
          numero_interior: direccion.numero_interior,
          colonia: direccion.colonia,
          codigo_postal: direccion.codigo_postal,
          ciudad: direccion.ciudad,
          estado: direccion.estado,
          pais: direccion.pais || 'México',
          referencias: direccion.referencias,
          contacto_nombre: direccion.contacto_nombre,
          contacto_telefono: direccion.contacto_telefono,
          is_default: direccion.is_default,
        })
        setEstadoSearch(direccion.estado || '')
        setCiudadSearch(direccion.ciudad || '')
      } else {
        form.resetFields()
        form.setFieldValue('pais', 'México')
        setEstadoSearch('')
        setCiudadSearch('')
      }
    }
  }, [open, direccion, form])

  // Update ciudad options when estado changes
  useEffect(() => {
    if (estadoSearch && esEstadoMexico(estadoSearch)) {
      const ciudades = getCiudadesByEstado(estadoSearch)
      setCiudadOptions(ciudades.map(c => ({ value: c, label: c })))
    } else {
      setCiudadOptions([])
    }
  }, [estadoSearch])

  const handleEstadoSearch = (searchText: string) => {
    setEstadoSearch(searchText)

    if (!searchText) {
      setEstadoOptions(ESTADOS_MEXICO.map(e => ({ value: e.value, label: e.label })))
      return
    }

    const busqueda = searchText.toLowerCase()
    const filtrados = ESTADOS_MEXICO.filter(e =>
      e.label.toLowerCase().includes(busqueda)
    )

    if (filtrados.length === 0) {
      setEstadoOptions([{ value: searchText, label: `"${searchText}" (otro)` }])
    } else {
      setEstadoOptions(filtrados.map(e => ({ value: e.value, label: e.label })))
    }
  }

  const handleEstadoSelect = (value: string) => {
    setEstadoSearch(value)
    form.setFieldValue('estado', value)
    // Clear ciudad when estado changes
    setCiudadSearch('')
    form.setFieldValue('ciudad', '')
  }

  const handleCiudadSearch = (searchText: string) => {
    setCiudadSearch(searchText)
    const estadoValue = form.getFieldValue('estado')

    const ciudadesBase = estadoValue && esEstadoMexico(estadoValue)
      ? getCiudadesByEstado(estadoValue)
      : []

    if (!searchText) {
      setCiudadOptions(ciudadesBase.map(c => ({ value: c, label: c })))
      return
    }

    const busqueda = searchText.toLowerCase()
    const filtradas = ciudadesBase.filter(c =>
      c.toLowerCase().includes(busqueda)
    )

    if (filtradas.length === 0) {
      setCiudadOptions([{ value: searchText, label: `"${searchText}" (otra)` }])
    } else {
      setCiudadOptions(filtradas.map(c => ({ value: c, label: c })))
    }
  }

  const handleCiudadSelect = (value: string) => {
    setCiudadSearch(value)
    form.setFieldValue('ciudad', value)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      // Ensure estado and ciudad are from the local state if user typed without selecting
      const formData = {
        ...values,
        estado: estadoSearch || values.estado,
        ciudad: ciudadSearch || values.ciudad,
      }

      if (isEditing && direccion) {
        const updateData: DireccionEnvioUpdate & { id: string } = {
          id: direccion.id,
          alias: formData.alias,
          calle: formData.calle || null,
          numero_exterior: formData.numero_exterior || null,
          numero_interior: formData.numero_interior || null,
          colonia: formData.colonia || null,
          codigo_postal: formData.codigo_postal || null,
          ciudad: formData.ciudad || null,
          estado: formData.estado || null,
          pais: formData.pais || null,
          referencias: formData.referencias || null,
          contacto_nombre: formData.contacto_nombre || null,
          contacto_telefono: formData.contacto_telefono || null,
          is_default: formData.is_default || false,
        }

        const updated = await updateMutation.mutateAsync(updateData)
        message.success('Direccion actualizada')
        onSuccess?.(updated)
      } else {
        const insertData: DireccionEnvioInsert = {
          cliente_id: clienteId,
          alias: formData.alias,
          calle: formData.calle || null,
          numero_exterior: formData.numero_exterior || null,
          numero_interior: formData.numero_interior || null,
          colonia: formData.colonia || null,
          codigo_postal: formData.codigo_postal || null,
          ciudad: formData.ciudad || null,
          estado: formData.estado || null,
          pais: formData.pais || null,
          referencias: formData.referencias || null,
          contacto_nombre: formData.contacto_nombre || null,
          contacto_telefono: formData.contacto_telefono || null,
          is_default: formData.is_default || false,
          organizacion_id: orgId,
        } as any

        const created = await createMutation.mutateAsync(insertData)
        message.success('Direccion agregada')
        onSuccess?.(created)
      }

      onClose()
    } catch (error: any) {
      if (error.errorFields) {
        // Form validation error
        return
      }
      console.error('Error saving direccion:', error)
      message.error(error.message || 'Error al guardar direccion')
    }
  }

  const loading = createMutation.isPending || updateMutation.isPending

  return (
    <Modal
      title={isEditing ? 'Editar Direccion de Envio' : 'Nueva Direccion de Envio'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      okText={isEditing ? 'Guardar' : 'Agregar'}
      cancelText="Cancelar"
      confirmLoading={loading}
      width={700}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="alias"
          label="Nombre/Alias de la direccion"
          rules={[{ required: true, message: 'El alias es requerido' }]}
        >
          <Input placeholder="Ej: Oficina Principal, Bodega Norte, Casa..." />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="calle" label="Calle">
              <Input placeholder="Nombre de la calle" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="numero_exterior" label="No. Exterior">
              <Input placeholder="123" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item name="numero_interior" label="No. Interior">
              <Input placeholder="Depto 5B" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Form.Item name="colonia" label="Colonia">
              <Input placeholder="Colonia o fraccionamiento" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="codigo_postal" label="C.P.">
              <Input placeholder="03100" maxLength={10} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="estado" label="Estado">
              <AutoComplete
                value={estadoSearch}
                options={estadoOptions}
                onSearch={handleEstadoSearch}
                onSelect={handleEstadoSelect}
                onChange={setEstadoSearch}
                onBlur={() => form.setFieldValue('estado', estadoSearch)}
                onFocus={() => handleEstadoSearch(estadoSearch)}
                placeholder="Buscar estado..."
                allowClear
                onClear={() => {
                  setEstadoSearch('')
                  form.setFieldValue('estado', '')
                  setCiudadSearch('')
                  form.setFieldValue('ciudad', '')
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="ciudad" label="Ciudad">
              <AutoComplete
                value={ciudadSearch}
                options={ciudadOptions}
                onSearch={handleCiudadSearch}
                onSelect={handleCiudadSelect}
                onChange={setCiudadSearch}
                onBlur={() => form.setFieldValue('ciudad', ciudadSearch)}
                onFocus={() => handleCiudadSearch(ciudadSearch)}
                placeholder="Buscar ciudad..."
                allowClear
                onClear={() => {
                  setCiudadSearch('')
                  form.setFieldValue('ciudad', '')
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="pais" label="Pais">
              <Input placeholder="Mexico" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="referencias" label="Referencias">
          <TextArea rows={2} placeholder="Entre calle X y Y, frente a..." />
        </Form.Item>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="contacto_nombre" label="Contacto para Envio">
              <Input placeholder="Nombre de quien recibe" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="contacto_telefono" label="Telefono">
              <Input placeholder="Telefono de contacto" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="is_default" valuePropName="checked">
          <Checkbox>Establecer como direccion predeterminada</Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  )
}
