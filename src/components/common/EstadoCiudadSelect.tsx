'use client'

import { useState, useEffect } from 'react'
import { AutoComplete, Space, Typography } from 'antd'
import { ESTADOS_MEXICO, getCiudadesByEstado, esEstadoMexico } from '@/lib/config/mexico'

const { Text } = Typography

interface EstadoCiudadSelectProps {
  estadoValue?: string | null
  ciudadValue?: string | null
  onEstadoChange: (value: string) => void
  onCiudadChange: (value: string) => void
  disabled?: boolean
  layout?: 'horizontal' | 'vertical'
  showLabels?: boolean
}

export default function EstadoCiudadSelect({
  estadoValue,
  ciudadValue,
  onEstadoChange,
  onCiudadChange,
  disabled = false,
  layout = 'horizontal',
  showLabels = true,
}: EstadoCiudadSelectProps) {
  const [estadoSearch, setEstadoSearch] = useState(estadoValue || '')
  const [ciudadSearch, setCiudadSearch] = useState(ciudadValue || '')
  const [estadoOptions, setEstadoOptions] = useState<{ value: string; label: string }[]>([])
  const [ciudadOptions, setCiudadOptions] = useState<{ value: string; label: string }[]>([])

  // Sincronizar valores externos
  useEffect(() => {
    setEstadoSearch(estadoValue || '')
  }, [estadoValue])

  useEffect(() => {
    setCiudadSearch(ciudadValue || '')
  }, [ciudadValue])

  // Actualizar opciones de ciudades cuando cambia el estado
  useEffect(() => {
    if (estadoValue && esEstadoMexico(estadoValue)) {
      const ciudades = getCiudadesByEstado(estadoValue)
      setCiudadOptions(ciudades.map(c => ({ value: c, label: c })))
    } else {
      setCiudadOptions([])
    }
  }, [estadoValue])

  // Buscar estados
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

    // Si no hay coincidencias, mostrar opcion de texto libre
    if (filtrados.length === 0) {
      setEstadoOptions([{ value: searchText, label: `"${searchText}" (otro)` }])
    } else {
      setEstadoOptions(filtrados.map(e => ({ value: e.value, label: e.label })))
    }
  }

  // Buscar ciudades
  const handleCiudadSearch = (searchText: string) => {
    setCiudadSearch(searchText)

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

    // Si no hay coincidencias, mostrar opcion de texto libre
    if (filtradas.length === 0) {
      setCiudadOptions([{ value: searchText, label: `"${searchText}" (otra)` }])
    } else {
      setCiudadOptions(filtradas.map(c => ({ value: c, label: c })))
    }
  }

  // Seleccionar estado
  const handleEstadoSelect = (value: string) => {
    setEstadoSearch(value)
    onEstadoChange(value)
    // Limpiar ciudad si cambia el estado
    setCiudadSearch('')
    onCiudadChange('')
  }

  // Seleccionar ciudad
  const handleCiudadSelect = (value: string) => {
    setCiudadSearch(value)
    onCiudadChange(value)
  }

  // Cuando pierde el foco, usar el valor escrito
  const handleEstadoBlur = () => {
    if (estadoSearch && estadoSearch !== estadoValue) {
      onEstadoChange(estadoSearch)
    }
  }

  const handleCiudadBlur = () => {
    if (ciudadSearch && ciudadSearch !== ciudadValue) {
      onCiudadChange(ciudadSearch)
    }
  }

  const containerStyle = layout === 'vertical'
    ? { display: 'flex', flexDirection: 'column' as const, gap: 8, width: '100%' }
    : { display: 'flex', gap: 8, width: '100%' }

  return (
    <div style={containerStyle}>
      <div style={{ flex: 1 }}>
        {showLabels && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Estado</Text>}
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
          disabled={disabled}
          allowClear
          onClear={() => {
            setEstadoSearch('')
            onEstadoChange('')
            setCiudadSearch('')
            onCiudadChange('')
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        {showLabels && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Ciudad</Text>}
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
          disabled={disabled}
          allowClear
          onClear={() => {
            setCiudadSearch('')
            onCiudadChange('')
          }}
        />
      </div>
    </div>
  )
}
