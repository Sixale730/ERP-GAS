'use client'

/**
 * ErrorReporter: provider global de reporte de errores.
 *
 * Monta un boton flotante "Reportar error" + un modal que cualquier
 * componente puede abrir via el contexto `useErrorReporter().openReporter()`.
 * Tambien instala listeners para `window.onerror` y `unhandledrejection`,
 * que prefill-an el modal con el stack capturado.
 *
 * Se monta una sola vez en el (dashboard) layout para no aparecer en
 * paginas publicas (landing, login, etc.).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Modal, Form, Input, Button, message, Tooltip, Typography, Alert } from 'antd'
import { BugOutlined } from '@ant-design/icons'
import { useReportarError } from '@/lib/hooks/useReportarError'

const { TextArea } = Input
const { Text } = Typography

interface PrefillData {
  mensaje_tecnico?: string | null
  stack?: string | null
  origen?: 'manual' | 'boundary' | 'window_error' | 'unhandled_rejection' | 'api'
  contexto?: Record<string, unknown> | null
}

interface ErrorReporterContextValue {
  openReporter: (prefill?: PrefillData) => void
}

const ErrorReporterContext = createContext<ErrorReporterContextValue | null>(null)

export function useErrorReporter() {
  const ctx = useContext(ErrorReporterContext)
  if (!ctx) {
    return {
      openReporter: () => {
        // eslint-disable-next-line no-console
        console.warn('[ErrorReporter] Provider no montado')
      },
    } as ErrorReporterContextValue
  }
  return ctx
}

export default function ErrorReporter({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const prefillRef = useRef<PrefillData | null>(null)
  const [form] = Form.useForm<{ descripcion: string; pasos?: string }>()
  const pathname = usePathname()
  const reportar = useReportarError()

  // Throttling de capturas automaticas para no spammear si una pagina
  // dispara muchos errores
  const ultimoErrorAutomaticoRef = useRef<number>(0)

  const openReporter = useCallback((prefill?: PrefillData) => {
    prefillRef.current = prefill ?? null
    setOpen(true)
  }, [])

  // Listeners globales: window.onerror y unhandledrejection. Solo
  // capturan, no abren modal automaticamente — el modal lo abre el
  // usuario al hacer click en el boton flotante. Lo que hacemos es
  // dejar el ultimo error "armado" en prefillRef para que cuando el
  // usuario abra el reporter ya venga prellenado.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onError = (event: ErrorEvent) => {
      const now = Date.now()
      if (now - ultimoErrorAutomaticoRef.current < 2000) return
      ultimoErrorAutomaticoRef.current = now
      prefillRef.current = {
        origen: 'window_error',
        mensaje_tecnico: event.message,
        stack: event.error?.stack ?? null,
        contexto: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      }
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const now = Date.now()
      if (now - ultimoErrorAutomaticoRef.current < 2000) return
      ultimoErrorAutomaticoRef.current = now
      const reason = event.reason
      prefillRef.current = {
        origen: 'unhandled_rejection',
        mensaje_tecnico: typeof reason === 'string' ? reason : (reason?.message ?? String(reason ?? '')),
        stack: reason?.stack ?? null,
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  const handleClose = useCallback(() => {
    if (submitting) return
    setOpen(false)
    form.resetFields()
    prefillRef.current = null
  }, [submitting, form])

  const handleSubmit = useCallback(async () => {
    let values: { descripcion: string; pasos?: string }
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSubmitting(true)
    const prefill = prefillRef.current
    const res = await reportar({
      descripcion: values.descripcion,
      pasos: values.pasos ?? null,
      ruta: pathname,
      mensaje_tecnico: prefill?.mensaje_tecnico ?? null,
      stack: prefill?.stack ?? null,
      contexto: prefill?.contexto ?? null,
      origen: prefill?.origen ?? 'manual',
    })
    setSubmitting(false)
    if (res.success) {
      message.success('Reporte enviado. El equipo lo revisara pronto.')
      setOpen(false)
      form.resetFields()
      prefillRef.current = null
    } else {
      message.error(res.error || 'No se pudo enviar el reporte')
    }
  }, [form, reportar, pathname])

  const contextValue = useMemo(() => ({ openReporter }), [openReporter])

  const prefillTipo = prefillRef.current?.origen
  const prefillMensaje = prefillRef.current?.mensaje_tecnico

  return (
    <ErrorReporterContext.Provider value={contextValue}>
      {children}
      <Tooltip title="Reportar un error" placement="left">
        <Button
          type="primary"
          danger
          shape="circle"
          size="large"
          icon={<BugOutlined />}
          onClick={() => openReporter()}
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 1100,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}
          aria-label="Reportar error"
        />
      </Tooltip>

      <Modal
        title={
          <span>
            <BugOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            Reportar un error
          </span>
        }
        open={open}
        onCancel={handleClose}
        maskClosable={!submitting}
        closable={!submitting}
        footer={[
          <Button key="cancel" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
            Enviar reporte
          </Button>,
        ]}
      >
        {prefillTipo && prefillTipo !== 'manual' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="Se detecto un error automaticamente"
            description={
              prefillMensaje
                ? <Text code style={{ fontSize: 12 }}>{prefillMensaje.slice(0, 200)}</Text>
                : 'Lo adjuntaremos como contexto tecnico.'
            }
          />
        )}
        <Form form={form} layout="vertical" disabled={submitting}>
          <Form.Item
            name="descripcion"
            label="¿Que intentabas hacer y que pasó?"
            rules={[
              { required: true, message: 'Cuentanos brevemente que pasó' },
              { min: 5, message: 'Al menos 5 caracteres' },
              { max: 5000, message: 'Maximo 5000 caracteres' },
            ]}
          >
            <TextArea
              autoFocus
              rows={4}
              placeholder="Ej: Al intentar guardar la cotizacion CT-1234 me aparece un mensaje rojo y no se guarda."
              showCount
              maxLength={1000}
            />
          </Form.Item>
          <Form.Item
            name="pasos"
            label="Pasos para reproducirlo (opcional)"
          >
            <TextArea
              rows={3}
              placeholder="1) Abro /cotizaciones/nueva 2) Selecciono cliente X 3) Clic en Guardar..."
              maxLength={3000}
              showCount
            />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Se adjuntara automaticamente: ruta actual, navegador, tu usuario y el error tecnico (si se detecto).
          </Text>
        </Form>
      </Modal>
    </ErrorReporterContext.Provider>
  )
}
