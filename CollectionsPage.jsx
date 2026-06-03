import { useState, useEffect, useMemo } from 'react'
import Navbar from '../components/layout/Navbar'
import ProductCard from '../components/products/ProductCard'
import api from '../services/api'

const CATEGORIES = ['all', 'shirts', 'pants', 'shoes', 'watches', 'accessories', 'jackets']

export default function CollectionsPage() {
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])   // full list for brand extraction
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ category: 'all', brand: '' })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Derive available brands from all products in DB (fetched once)
  useEffect(() => {
    const fetchAllForBrands = async () => {
      try {
        const res = await api.get('/products?limit=500')
        setAllProducts(res.data.products || [])
      } catch {
        setAllProducts([])
      }
    }
    fetchAllForBrands()
  }, [])

  const availableBrands = useMemo(() => {
    const brands = [...new Set(
      allProducts
        .map(p => p.brand)
        .filter(Boolean)
    )].sort()
    return brands
  }, [allProducts])

  useEffect(() => {
    fetchProducts()
  }, [filters, page])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 12 })
      if (filters.category !== 'all') params.set('category', filters.category)
      if (filters.brand && filters.brand !== 'All Brands') params.set('brand', filters.brand)

      const res = await api.get(`/products?${params}`)
      setProducts(res.data.products)
      setTotalPages(res.data.pages)
    } catch (err) {
      console.error('Failed to fetch products:', err)
      setProducts([])
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-gray-900">Collections</h1>
          <p className="text-gray-500 text-sm mt-1">Curated selections for the discerning scholar</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { setFilters({ ...filters, category: cat }); setPage(1) }}
                className={`text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full transition-colors ${
                  filters.category === cat
                    ? 'bg-brand-primary text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-brand-primary hover:text-brand-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <select
            className="input-field w-auto text-sm"
            value={filters.brand}
            onChange={e => { setFilters({ ...filters, brand: e.target.value }); setPage(1) }}
          >
            <option value="">All Brands</option>
            {availableBrands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer rounded-2xl aspect-[3/4]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="font-display text-xl">No items found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-10 h-10 rounded-xl font-semibold text-sm transition-colors ${
                  page === p ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 border hover:border-brand-primary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
