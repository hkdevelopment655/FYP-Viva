import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Eye } from 'lucide-react'
import { useCartStore } from '../../context/cartStore'
import toast from 'react-hot-toast'

export default function ProductCard({ product, compact = false }) {
  const navigate = useNavigate()
  const { addItem } = useCartStore()

  const handleAddToCart = (e) => {
    e.stopPropagation()
    addItem(product, product.sizes?.[0] || 'M', product.colors?.[0] || '')
    toast.success(`${product.name} added to cart`)
  }

  return (
    <div
      className={`product-card card cursor-pointer w-full ${compact ? '' : 'hover:-translate-y-1 transition-transform duration-200'}`}
      onClick={() => navigate(`/product/${product._id}`)}
    >
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        <img
          src={product.images?.[0] || 'https://placehold.co/400x400/e8edf5/1E3A8A?text=Product'}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={e => { e.target.src = 'https://placehold.co/400x400/e8edf5/1E3A8A?text=Product' }}
        />
        <div className="product-overlay absolute inset-0 bg-brand-primary/80 flex items-center justify-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); navigate(`/product/${product._id}`) }}
            className="bg-white text-brand-primary p-2 rounded-full hover:scale-110 transition-transform"
            title="View Details"
          >
            <Eye size={18} />
          </button>
          <button
            onClick={handleAddToCart}
            className="bg-white text-brand-primary p-2 rounded-full hover:scale-110 transition-transform"
            title="Add to Cart"
          >
            <ShoppingCart size={18} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-body font-semibold text-gray-800 text-sm mb-1 line-clamp-1">{product.name}</h3>
        <p className="text-brand-primary font-semibold text-sm mb-3">Rs. {product.price?.toLocaleString()}</p>
        <button
          onClick={e => { e.stopPropagation(); navigate(`/product/${product._id}`) }}
          className="w-full bg-brand-dark text-white text-xs font-semibold tracking-widest py-2.5 rounded-lg hover:bg-brand-primary transition-colors"
        >
          VIEW DETAILS
        </button>
      </div>
    </div>
  )
}
