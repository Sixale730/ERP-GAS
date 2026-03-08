import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { POSCartItem, ProductoPOS } from '@/types/pos'

interface POSState {
  // Cart
  items: POSCartItem[]
  addItem: (product: ProductoPOS, cantidad?: number) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, cantidad: number) => void
  updateDiscount: (key: string, descuento: number) => void
  clearCart: () => void

  // Global discount
  descuentoGlobal: number
  setDescuentoGlobal: (pct: number) => void

  // Caja / Turno context
  cajaId: string | null
  turnoId: string | null
  almacenId: string | null
  listaPrecioId: string | null
  clienteDefaultId: string | null
  cajaNombre: string | null
  setCajaContext: (ctx: {
    cajaId: string
    almacenId: string
    listaPrecioId: string | null
    clienteDefaultId: string | null
    cajaNombre: string
  }) => void
  setTurnoId: (turnoId: string | null) => void
  clearCajaContext: () => void

  // Scale
  pesoBascula: number | null
  setPesoBascula: (peso: number | null) => void

  // Last sale (for reprint)
  lastSaleData: Record<string, unknown> | null
  setLastSaleData: (data: Record<string, unknown> | null) => void
}

function calcSubtotal(precio: number, cantidad: number, descuento: number): number {
  const base = precio * cantidad
  return Math.round((base - base * descuento / 100) * 100) / 100
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      // Cart
      items: [],

      addItem: (product, cantidad) => {
        const items = get().items
        const existing = items.find(i => i.producto_id === product.id)

        if (existing) {
          // Increment quantity
          const newCantidad = existing.cantidad + (cantidad ?? 1)
          set({
            items: items.map(i =>
              i.key === existing.key
                ? { ...i, cantidad: newCantidad, subtotal: calcSubtotal(i.precio_unitario, newCantidad, i.descuento_porcentaje) }
                : i
            ),
          })
        } else {
          const precio = product.precio_con_iva ?? product.precio ?? 0
          const qty = cantidad ?? 1
          const newItem: POSCartItem = {
            key: `${product.id}-${Date.now()}`,
            producto_id: product.id,
            sku: product.sku,
            nombre: product.nombre,
            codigo_barras: product.codigo_barras,
            precio_unitario: precio,
            cantidad: qty,
            descuento_porcentaje: 0,
            subtotal: calcSubtotal(precio, qty, 0),
            unidad_medida: product.unidad_medida,
            es_granel: product.unidad_medida === 'KG',
            tasa_ieps: product.tasa_ieps || 0,
          }
          set({ items: [...items, newItem] })
        }
      },

      removeItem: (key) => {
        set({ items: get().items.filter(i => i.key !== key) })
      },

      updateQuantity: (key, cantidad) => {
        if (cantidad <= 0) {
          set({ items: get().items.filter(i => i.key !== key) })
          return
        }
        set({
          items: get().items.map(i =>
            i.key === key
              ? { ...i, cantidad, subtotal: calcSubtotal(i.precio_unitario, cantidad, i.descuento_porcentaje) }
              : i
          ),
        })
      },

      updateDiscount: (key, descuento) => {
        set({
          items: get().items.map(i =>
            i.key === key
              ? { ...i, descuento_porcentaje: descuento, subtotal: calcSubtotal(i.precio_unitario, i.cantidad, descuento) }
              : i
          ),
        })
      },

      clearCart: () => set({ items: [], descuentoGlobal: 0 }),

      // Global discount
      descuentoGlobal: 0,
      setDescuentoGlobal: (pct) => set({ descuentoGlobal: pct }),

      // Caja / Turno
      cajaId: null,
      turnoId: null,
      almacenId: null,
      listaPrecioId: null,
      clienteDefaultId: null,
      cajaNombre: null,

      setCajaContext: (ctx) => set({
        cajaId: ctx.cajaId,
        almacenId: ctx.almacenId,
        listaPrecioId: ctx.listaPrecioId,
        clienteDefaultId: ctx.clienteDefaultId,
        cajaNombre: ctx.cajaNombre,
      }),

      setTurnoId: (turnoId) => set({ turnoId }),

      clearCajaContext: () => set({
        cajaId: null,
        turnoId: null,
        almacenId: null,
        listaPrecioId: null,
        clienteDefaultId: null,
        cajaNombre: null,
        items: [],
        descuentoGlobal: 0,
      }),

      // Scale
      pesoBascula: null,
      setPesoBascula: (peso) => set({ pesoBascula: peso }),

      // Last sale
      lastSaleData: null,
      setLastSaleData: (data) => set({ lastSaleData: data }),
    }),
    {
      name: 'cuanty-pos-storage',
      partialize: (state) => ({
        cajaId: state.cajaId,
        almacenId: state.almacenId,
        listaPrecioId: state.listaPrecioId,
        clienteDefaultId: state.clienteDefaultId,
        cajaNombre: state.cajaNombre,
        // No persist: items, turnoId, pesoBascula, lastSaleData
      }),
    }
  )
)
