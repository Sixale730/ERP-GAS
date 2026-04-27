'use client'

import { useState, useEffect } from 'react'
import { Switch, InputNumber, Input, Select, Button, Space, Tooltip, message } from 'antd'
import { UndoOutlined, SaveOutlined } from '@ant-design/icons'
import type { ConfigItem } from '@/types/configuracion-sistema'
import { useSetConfig, useResetConfig } from '@/lib/hooks/queries/useConfiguracionSistema'

interface Props {
  item: ConfigItem
}

function isModificado(valor: unknown, valorDefault: unknown): boolean {
  return JSON.stringify(valor) !== JSON.stringify(valorDefault)
}

export function ConfigEditor({ item }: Props) {
  const [localValue, setLocalValue] = useState<unknown>(item.valor)
  const setConfig = useSetConfig()
  const resetConfig = useResetConfig()

  useEffect(() => {
    setLocalValue(item.valor)
  }, [item.valor])

  const dirty = JSON.stringify(localValue) !== JSON.stringify(item.valor)

  const handleSave = async () => {
    try {
      await setConfig.mutateAsync({
        categoria: item.categoria,
        clave: item.clave,
        valor: localValue,
      })
      message.success(`${item.clave} guardado`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      message.error(msg)
    }
  }

  const handleReset = async () => {
    try {
      await resetConfig.mutateAsync({
        categoria: item.categoria,
        clave: item.clave,
      })
      message.success(`${item.clave} restaurado al default`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al restaurar'
      message.error(msg)
    }
  }

  const renderControl = () => {
    switch (item.tipo) {
      case 'boolean':
        return (
          <Switch
            checked={!!localValue}
            onChange={(v) => setLocalValue(v)}
          />
        )
      case 'number':
        return (
          <InputNumber
            value={localValue as number | null}
            onChange={(v) => setLocalValue(v)}
            min={item.min_valor ?? undefined}
            max={item.max_valor ?? undefined}
            style={{ width: 140 }}
          />
        )
      case 'enum':
        return (
          <Select
            value={localValue as string}
            onChange={(v) => setLocalValue(v)}
            options={(item.opciones ?? []).map((o) => ({ label: o, value: o }))}
            style={{ width: 160 }}
          />
        )
      case 'string':
        return (
          <Input
            value={localValue as string}
            onChange={(e) => setLocalValue(e.target.value)}
            style={{ width: 220 }}
          />
        )
      case 'json':
        return (
          <Input.TextArea
            value={typeof localValue === 'string' ? localValue : JSON.stringify(localValue)}
            onChange={(e) => {
              try {
                setLocalValue(JSON.parse(e.target.value))
              } catch {
                setLocalValue(e.target.value)
              }
            }}
            rows={2}
            style={{ width: 280 }}
          />
        )
      default:
        return null
    }
  }

  const modificado = isModificado(item.valor, item.valor_default)

  return (
    <Space size={6}>
      {renderControl()}
      {dirty && (
        <Button
          type="primary"
          size="small"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={setConfig.isPending}
        >
          Guardar
        </Button>
      )}
      {modificado && !dirty && (
        <Tooltip title="Restaurar al valor por defecto">
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={handleReset}
            loading={resetConfig.isPending}
          />
        </Tooltip>
      )}
    </Space>
  )
}
