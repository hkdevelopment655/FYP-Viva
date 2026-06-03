import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import { useCartStore } from '../context/cartStore'
import toast from 'react-hot-toast'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, removeItem, updateQuantity } = useCartStore()
  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
  const shipping = total > 2000 ? 0 : 150

  if (!items.length) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <ShoppingBag size={48} className="mb-4" />
        <h2 className="font-display text-2xl font-bold mb-2">Your vault is empty</h2>
        <p className="text-sm mb-6">Curate your collection to begin</p>
        <button onClick={() => navigate('/collections')} className="btn-primary">Browse Collections</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-8">Your Cart</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {items.map(item => (
              <div key={`${item._id}-${item.size}`} className="card p-5 flex gap-4">
                <img
                  src={item.images?.[0] || 'https://placehold.co/80x80/e8edf5/1E3A8A?text=Item'}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded-xl"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                  <p className="text-xs text-gray-400 mb-2">Size: {item.size}</p>
                  <p className="text-brand-primary font-semibold">Rs. {item.price?.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <button onClick={() => removeItem(item._id, item.size)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                  <div className="flex items-center gap-2 border rounded-lg">
                    <button onClick={() => updateQuantity(item._id, item.size, item.quantity - 1)} className="p-1.5 hover:bg-gray-50">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item._id, item.size, item.quantity + 1)} className="p-1.5 hover:bg-gray-50">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6 h-fit">
            <h3 className="font-display font-bold text-lg mb-5">Order Summary</h3>
            <div className="space-y-3 text-sm mb-5">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>Rs. {total.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-600"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : `Rs. ${shipping}`}</span></div>
              <div className="flex justify-between font-bold text-base pt-3 border-t">
                <span>Total</span><span className="text-brand-primary">Rs. {(total + shipping).toLocaleString()}</span>
              </div>
            </div>
            <button onClick={() => navigate('/checkout')} className="w-full btn-primary justify-center py-3.5">
              Proceed to Checkout
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">Secured by Easypaisa</p>
          </div>
        </div>
      </div>
    </div>
  )
}
