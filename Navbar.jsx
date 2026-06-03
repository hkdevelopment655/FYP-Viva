import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, User, Settings, Users } from 'lucide-react'
import { useAuthStore } from '../../context/authStore'
import { useCartStore } from '../../context/cartStore'
import api from '../../services/api'

const ACTIVE_GROUP_CART_KEY = 'smart-ai-active-group-cart-id'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { items } = useCartStore()
  const [activeGroupCart, setActiveGroupCart] = useState(() => {
    if (typeof window === 'undefined') return null
    const storedId = localStorage.getItem(ACTIVE_GROUP_CART_KEY)
    return storedId ? { _id: storedId } : null
  })

  const navLinks = [
    { to: '/home', label: 'HOME' },
    { to: '/collections', label: 'COLLECTIONS' },
    { to: '/brands', label: 'BRANDS' },
    { to: '/track-order', label: 'TRACK ORDER' },
  ]


  const isActive = (path) => location.pathname === path.split('?')[0]

  useEffect(() => {
    const fetchActiveGroupCart = async () => {
      try {
        const res = await api.get('/group-cart')
        const cart = res.data.groupCarts?.[0] || null
        setActiveGroupCart(cart)
        if (cart?._id) {
          localStorage.setItem(ACTIVE_GROUP_CART_KEY, cart._id)
        } else {
          localStorage.removeItem(ACTIVE_GROUP_CART_KEY)
        }
      } catch (_err) {
        setActiveGroupCart(null)
        localStorage.removeItem(ACTIVE_GROUP_CART_KEY)
      }
    }

    fetchActiveGroupCart()
  }, [location.pathname])

  const groupCartButtonLabel = activeGroupCart ? 'OPEN GROUP CART' : 'CREATE GROUP CART'
  const handleGroupCartClick = () => {
    if (activeGroupCart?._id) {
      navigate(`/group-cart/${activeGroupCart._id}`)
    } else {
      navigate('/group-cart')
    }
  }

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/home" className="font-display font-bold text-xl text-brand-primary italic">Smart AI</Link>
        <div className="hidden md:flex gap-6">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-xs font-body font-semibold tracking-widest transition-colors ${
                isActive(link.to) ? 'text-brand-primary border-b-2 border-brand-primary pb-0.5' : 'text-gray-500 hover:text-brand-primary'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleGroupCartClick}
          className="btn-primary text-xs py-2 px-4 rounded-lg flex items-center gap-2"
        >
          <Users size={14} /> {groupCartButtonLabel}
        </button>

        <Link to="/cart" className="relative p-2 text-gray-600 hover:text-brand-primary transition-colors">
          <ShoppingCart size={20} />
          {(() => {
            const uniqueCount = new Set(items.map(i => i._id)).size;
            return uniqueCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-primary text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {uniqueCount}
              </span>
            );
          })()}
        </Link>

        <Link to="/profile" className="p-2 text-gray-600 hover:text-brand-primary transition-colors">
          <User size={20} />
        </Link>

        {user?.role === 'admin' && (
          <Link to="/admin" className="p-2 text-gray-600 hover:text-brand-primary transition-colors">
            <Settings size={20} />
          </Link>
        )}
      </div>
    </nav>
  )
}
