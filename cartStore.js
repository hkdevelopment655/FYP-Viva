import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, size, color, quantity = 1) => {
        const { items } = get()
        const existing = items.find(i => i._id === product._id && i.size === size)
        if (existing) {
          set({ items: items.map(i => i._id === product._id && i.size === size ? { ...i, quantity: i.quantity + quantity } : i) })
        } else {
          set({ items: [...items, { ...product, size, color, quantity }] })
        }
      },

      removeItem: (id, size) => set({ items: get().items.filter(i => !(i._id === id && i.size === size)) }),

      updateQuantity: (id, size, quantity) => {
        if (quantity < 1) { get().removeItem(id, size); return }
        set({ items: get().items.map(i => i._id === id && i.size === size ? { ...i, quantity } : i) })
      },

      clearCart: () => set({ items: [] }),

      get total() { return get().items.reduce((acc, i) => acc + i.price * i.quantity, 0) },
      get count() {
        const uniqueIds = new Set(get().items.map(i => i._id))
        return uniqueIds.size
      },
    }),
    { name: 'smart-ai-cart' }
  )
)
