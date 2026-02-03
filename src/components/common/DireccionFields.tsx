'use client'

import { useState, useEffect } from 'react'
import { Form, Input, Row, Col, AutoComplete } from 'antd'
import type { FormInstance } from 'antd'
import { ESTADOS_MEXICO, getCiudadesByEstado, esEstadoMexico } from '@/lib/config/mexico'

const { TextArea } = Input

interface DireccionFieldsProps {
  form: FormInstance
  prefix?: '' | '_envio'
}

export default function DireccionFields({ form, prefix = '' }: DireccionFieldsProps) {
  const fieldName = (name: string) => `${name}${prefix}`

  const estadoField = fieldName('estado')
  const ciudadField = fieldName('ciudad')

  // Estado autocomplete
  const [estadoSearch, setEstadoSearch] = useState('')
  const [estadoOptions, setEstadoOptions] = useState<{ value: string; label: string }[]>([])

  // Ciudad autocomplete
  const [ciudadSearch, setCiudadSearch] = useState('')
  const [ciudadOptions, setCiudadOptions] = useState<{ value: string; label: string }[]>([])

  // Sync with form values
  useEffect(() => {
    const estadoValue = form.getFieldValue(estadoField)
    const ciudadValue = form.getFieldValue(ciudadField)
    if (estadoValue) setEstadoSearch(estadoValue)
    if (ciudadValue) setCiudadSearch(ciudadValue)
  }, [form, estadoField, ciudadField])

  // Update ciudad options when estado changes
  useEffect(() => {
    const estadoValue = form.getFieldValue(estadoField)
    if (estadoValue && esEstadoMexico(estadoValue)) {
      const ciudades = getCiudadesByEstado(estadoValue)
      setCiudadOptions(ciudades.map(c => ({ value: c, label: c })))
    } else {
      setCiudadOptions([])
    }
  }, [estadoSearch, form, estadoField])

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
    form.setFieldValue(estadoField, value)
    // Clear ciudad when estado changes
    setCiudadSearch('')
    form.setFieldValue(ciudadField, '')
  }

  const handleEstadoBlur = () => {
    if (estadoSearch) {
      form.setFieldValue(estadoField, estadoSearch)
    }
  }

  const handleCiudadSearch = (searchText: string) => {
    setCiudadSearch(searchText)
    const estadoValue = form.getFieldValue(estadoField)

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
    form.setFieldValue(ciudadField, value)
  }

  const handleCiudadBlur = () => {
    if (ciudadSearch) {
      form.setFieldValue(ciudadField, ciudadSearch)
    }
  }

  return (
    <Row gutter={16}>
      {/* Fila 1: Calle, No. Ext, No. Int */}
      <Col xs={24} md={12}>
        <Form.Item name={fieldName('calle')} label="Calle">
          <Input placeholder="Nombre de la calle" />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name={fieldName('numero_exterior')} label="No. Exterior">
          <Input placeholder="123" />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name={fieldName('numero_interior')} label="No. Interior">
          <Input placeholder="Depto 5B" />
        </Form.Item>
      </Col>

      {/* Fila 2: Colonia, C.P. */}
      <Col xs={24} md={16}>
        <Form.Item name={fieldName('colonia')} label="Colonia">
          <Input placeholder="Colonia o fraccionamiento" />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={fieldName('codigo_postal')} label="C.P.">
          <Input placeholder="03100" maxLength={10} />
        </Form.Item>
      </Col>

      {/* Fila 3: Estado, Ciudad, País - aligned equally */}
      <Col xs={24} md={8}>
        <Form.Item label="Estado">
          <AutoComplete
            style={{ width: '100%' }}
            value={estadoSearch}
            options={estadoOptions}
            onSearch={handleEstadoSearch}
            onSelect={handleEstadoSelect}
            onChange={setEstadoSearch}
            onBlur={handleEstadoBlur}
            onFocus={() => handleEstadoSearch(estadoSearch)}
            placeholder="Buscar estado..."
            allowClear
            onClear={() => {
              setEstadoSearch('')
              form.setFieldValue(estadoField, '')
              setCiudadSearch('')
              form.setFieldValue(ciudadField, '')
            }}
          />
          <Form.Item name={estadoField} hidden><Input /></Form.Item>
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item label="Ciudad">
          <AutoComplete
            style={{ width: '100%' }}
            value={ciudadSearch}
            options={ciudadOptions}
            onSearch={handleCiudadSearch}
            onSelect={handleCiudadSelect}
            onChange={setCiudadSearch}
            onBlur={handleCiudadBlur}
            onFocus={() => handleCiudadSearch(ciudadSearch)}
            placeholder="Buscar ciudad..."
            allowClear
            onClear={() => {
              setCiudadSearch('')
              form.setFieldValue(ciudadField, '')
            }}
          />
          <Form.Item name={ciudadField} hidden><Input /></Form.Item>
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name={fieldName('pais')} label="País" initialValue="México">
          <Input placeholder="México" />
        </Form.Item>
      </Col>

      {/* Fila 4: Referencias */}
      <Col xs={24}>
        <Form.Item name={fieldName('referencias')} label="Referencias">
          <TextArea rows={2} placeholder="Entre calle X y Y, frente a..." />
        </Form.Item>
      </Col>
    </Row>
  )
}
