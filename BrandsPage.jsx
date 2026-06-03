import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Navbar from '../components/layout/Navbar'
import api from '../services/api'

export default function BrandsPage() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const res = await api.get('/products?limit=500')
        const products = res.data.products || []
        const unique = [...new Set(products.map(p => p.brand).filter(Boolean))].sort()
        setBrands(unique)
      } catch {
        setBrands([])
      } finally {
        setLoading(false)
      }
    }
    fetchBrands()
  }, [])

  // Generate a deterministic pastel accent from the brand name
  const brandColor = (name) => {
    const palette = [
      'from-blue-50 to-indigo-100 border-indigo-200 text-indigo-800',
      'from-rose-50 to-pink-100 border-pink-200 text-pink-800',
      'from-amber-50 to-yellow-100 border-yellow-200 text-yellow-800',
      'from-emerald-50 to-green-100 border-green-200 text-green-800',
      'from-purple-50 to-violet-100 border-violet-200 text-violet-800',
      'from-cyan-50 to-sky-100 border-sky-200 text-sky-800',
      'from-orange-50 to-amber-100 border-amber-200 text-amber-800',
      'from-teal-50 to-emerald-100 border-emerald-200 text-emerald-800',
    ]
    const idx = name.charCodeAt(0) % palette.length
    return palette[idx]
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-display text-4xl font-bold text-gray-900 mb-3">Brands</h1>
          <p className="text-gray-500 text-sm">
            {loading ? 'Loading…' : `${brands.length} brand${brands.length !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Brand Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer rounded-2xl h-28" />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="font-display text-xl">No brands found</p>
            <p className="text-sm mt-2">Add products in the admin panel to see brands here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
            {brands.map((brand, i) => (
              <motion.div
                key={brand}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-gradient-to-br ${brandColor(brand)} border rounded-2xl flex items-center justify-center h-28 px-4 text-center shadow-sm`}
              >
                <span className="font-display font-bold text-lg leading-tight">
                  {brand}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
