import { useState, useEffect } from 'react'
import { Users, Package, ShoppingBag, TrendingUp, Plus, Trash2, Edit3 } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import AdminNavbar from '../components/layout/AdminNavbar'
import api from '../services/api'

const CATEGORIES = ['shirts', 'pants', 'shoes', 'watches', 'accessories', 'jackets', 'dresses']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const sizeOptions = {
  shirts: SIZES,
  jackets: SIZES,
  pants: ['28','30','32','34','36','38','40'],
  dresses: [...SIZES, ...['28','30','32','34','36','38','40']],
  shoes: ['6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11'],
  accessories: [],
  watches: []
};

export default function AdminPage() {
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [reviews, setReviews] = useState([])

  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [editingCustomSizeInput, setEditingCustomSizeInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingColorIndex, setUploadingColorIndex] = useState(null)
  const [productForm, setProductForm] = useState({
    name: '', brand: '', price: '', originalPrice: '', category: 'shirts',
    description: '', curatorNote: '', sizes: ['M'], colors: [''], images: [''], stock: 10,
    colorImages: []
  })
  const [customSizeInput, setCustomSizeInput] = useState('')

  useEffect(() => {
    if (tab === 'stats') fetchStats()
    else if (tab === 'users') fetchUsers()
    else if (tab === 'orders') fetchOrders()
    else if (tab === 'products') fetchAdminProducts() // <-- Added fetch trigger
    else if (tab === 'reviews') fetchAdminReviews()
  }, [tab])

  // Fetch real products from DB
  const fetchAdminProducts = async () => {
    try {
      const res = await api.get('/products?limit=100')
      setProducts(res.data.products)
    } catch {
      setProducts([])
    }
  }

  // Delete product logic
  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return
    try {
      await api.delete(`/products/${id}`)
      toast.success('Product deleted')
      fetchAdminProducts() // refresh the list
    } catch {
      toast.error('Failed to delete product')
    }
  }

  // Delete order logic
  const handleDeleteOrder = async (id) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return
    try {
      await api.delete(`/admin/orders/${id}`)
      toast.success('Order deleted')
      fetchOrders() // refresh the list
    } catch {
      toast.error('Failed to delete order')
    }
  }

  // Update order status logic
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const res = await api.put(`/admin/orders/${orderId}/status`, { status: newStatus })
      if (res.data.success) {
        toast.success('Order status updated!')
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: newStatus } : o))
      }
    } catch (err) {
      console.error('Error changing order status:', err)
      toast.error(err.response?.data?.message || 'Failed to update order status')
    }
  }



  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats')
      setStats(res.data.stats)
    } catch { setStats({ users: 0, products: 0, orders: 0, revenue: 0 }) }
  }

  const fetchUsers = async () => {
    try { const res = await api.get('/admin/users'); setUsers(res.data.users) } catch { setUsers([]) }
  }

  const fetchOrders = async () => {
    try { const res = await api.get('/admin/orders'); setOrders(res.data.orders) } catch { setOrders([]) }
  }

  const fetchAdminReviews = async () => {
    try {
      const res = await api.get('/products/reviews/all')
      setReviews(res.data.reviews || [])
    } catch {
      setReviews([])
    }
  }

  const handleDeleteReview = async (productId, reviewId) => {
    if (!productId) return toast.error('Product context missing')
    if (!window.confirm('Are you sure you want to delete this review?')) return
    try {
      await api.delete(`/products/${productId}/reviews/${reviewId}`)
      toast.success('Review deleted')
      fetchAdminReviews()
    } catch {
      toast.error('Failed to delete review')
    }
  }

  const handleImageUpload = async (e, mode = 'add') => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    setUploading(true)
    try {
      const res = await api.post('/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (mode === 'edit') {
        setEditingProduct(prev => ({ ...prev, images: [res.data.url] }))
      } else {
        setProductForm(prev => ({ ...prev, images: [res.data.url] }))
      }
      toast.success('Image uploaded!')
    } catch {
      toast.error('Failed to upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleColorImageUpload = async (e, index, mode = 'add') => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('image', file)
    setUploadingColorIndex(index)
    try {
      const res = await api.post('/products/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (mode === 'edit') {
        setEditingProduct(prev => {
          const colorImages = [...(prev.colorImages || [])]
          colorImages[index] = { ...colorImages[index], image: res.data.url }
          return { ...prev, colorImages }
        })
      } else {
        setProductForm(prev => {
          const colorImages = [...(prev.colorImages || [])]
          colorImages[index] = { ...colorImages[index], image: res.data.url }
          return { ...prev, colorImages }
        })
      }
      toast.success('Color image uploaded!')
    } catch {
      toast.error('Failed to upload color image')
    } finally {
      setUploadingColorIndex(null)
    }
  }

  const handleEditProduct = async (e) => {
    e.preventDefault()
    try {
      const derivedColors = (editingProduct.colorImages || []).map(ci => ci.color.trim()).filter(Boolean)
      await api.put(`/products/${editingProduct._id}`, {
        ...editingProduct,
        price: Number(editingProduct.price),
        originalPrice: Number(editingProduct.originalPrice),
        stock: Number(editingProduct.stock),
        images: editingProduct.images.filter(Boolean),
        sizes: editingProduct.sizes,
        colors: derivedColors.length > 0 ? derivedColors : (editingProduct.colors || []).filter(Boolean),
        colorImages: (editingProduct.colorImages || []).filter(ci => ci.color.trim() && ci.image.trim())
      })
      toast.success('Product updated!')
      setEditingProduct(null)
      fetchAdminProducts()
    } catch {
      toast.error('Failed to update product')
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    try {
      const derivedColors = (productForm.colorImages || []).map(ci => ci.color.trim()).filter(Boolean)
      await api.post('/products', {
        ...productForm,
        price: Number(productForm.price),
        originalPrice: Number(productForm.originalPrice),
        stock: Number(productForm.stock),
        images: productForm.images.filter(Boolean),
        colors: derivedColors.length > 0 ? derivedColors : productForm.colors.filter(Boolean),
        colorImages: (productForm.colorImages || []).filter(ci => ci.color.trim() && ci.image.trim())
      })
      toast.success('Product added!')
      setShowAddProduct(false)
      setProductForm({ name: '', brand: '', price: '', originalPrice: '', category: 'shirts', description: '', curatorNote: '', sizes: ['M'], colors: [''], images: [''], stock: 10, colorImages: [] })
      fetchAdminProducts()
    } catch { toast.error('Failed to add product') }
  }

  const statCards = [
    { label: 'Total Users', value: stats?.users ?? '–', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Products', value: stats?.products ?? '–', icon: Package, color: 'bg-green-50 text-green-600' },
    { label: 'Total Orders', value: stats?.orders ?? '–', icon: ShoppingBag, color: 'bg-purple-50 text-purple-600' },
    { label: 'Revenue (Rs.)', value: stats?.revenue ? stats.revenue.toLocaleString() : '–', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
  ]

  const tabs = [
    { id: 'stats', label: 'Dashboard' },
    { id: 'products', label: 'Products' },
    { id: 'users', label: 'Users' },
    { id: 'orders', label: 'Orders' },
    { id: 'reviews', label: 'Reviews' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm">Smart AI Platform Management</p>
          </div>
          <button onClick={() => setShowAddProduct(true)} className="btn-primary">
            <Plus size={16} /> Add Product
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === t.id ? 'bg-brand-primary text-white' : 'bg-white text-gray-500 border hover:text-brand-primary'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {tab === 'stats' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {statCards.map((card, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="card p-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}>
                  <card.icon size={20} />
                </div>
                <p className="font-display text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-gray-500 text-sm mt-1">{card.label}</p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Products */}
        {/* Products */}
        {tab === 'products' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Product', 'Price', 'Category', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img src={p.images?.[0] || 'https://placehold.co/40x40'} className="w-10 h-10 rounded object-cover" alt="" />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-brand-primary font-semibold">Rs. {p.price?.toLocaleString()}</td>
                    <td className="px-5 py-4 text-gray-500 capitalize">{p.category}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setEditingProduct({ ...p, colorImages: p.colorImages || [] })} 
                          className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                          title="Edit Product"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p._id)} 
                          className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!products.length && <p className="text-center py-10 text-gray-400">No products found</p>}
          </div>
        )}


        {/* Users */}
        {tab === 'users' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Username', 'Email', 'Role', 'Joined'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-bold">
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${u.role === 'admin' ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <p className="text-center py-10 text-gray-400">No users found</p>}
          </div>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Order ID', 'Customer', 'Total', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-gray-500">#{o._id.slice(-8).toUpperCase()}</td>
                    <td className="px-5 py-4 font-semibold">{o.user?.username || '—'}</td>
                    <td className="px-5 py-4 text-brand-primary font-semibold">Rs. {o.totalPrice?.toLocaleString()}</td>
                    <td className="px-5 py-4">
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o._id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg font-semibold border focus:outline-none transition-all cursor-pointer ${
                          o.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                          o.status === 'shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          o.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>

                    <td className="px-5 py-4 text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDeleteOrder(o._id)} 
                          className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete Order"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <p className="text-center py-10 text-gray-400">No orders found</p>}
          </div>
        )}

        {/* Reviews */}
        {tab === 'reviews' && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Reviewer', 'Product', 'Rating', 'Title & Comment', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reviews.map(r => (
                  <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-bold">
                          {r.userName?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold">{r.userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-gray-700">
                      {r.productId?.name || '—'}
                    </td>
                    <td className="px-5 py-4 text-amber-500 font-semibold">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={r.rating >= star ? 'text-amber-400' : 'text-gray-200'}>★</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-650 max-w-xs">
                      <div className="font-semibold text-gray-900 text-xs truncate">{r.title}</div>
                      <p className="text-gray-505 text-xs truncate mt-0.5">{r.comment}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleDeleteReview(r.productId?._id, r._id)} 
                          className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Delete Review"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!reviews.length && <p className="text-center py-10 text-gray-400">No reviews found</p>}
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 w-full max-w-xl my-4">
            <h2 className="font-display text-xl font-bold mb-3">Add New Product</h2>
            <form onSubmit={handleAddProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Product Name *</label>
                  <input className="input-field py-2" required value={productForm.name}
                    onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Brand *</label>
                  <input className="input-field py-2" required value={productForm.brand}
                    onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-sm">Price (Rs.) *</label>
                  <input type="number" className="input-field py-2" required value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Original Price</label>
                  <input type="number" className="input-field py-2" value={productForm.originalPrice}
                    onChange={e => setProductForm({ ...productForm, originalPrice: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Stock</label>
                  <input type="number" className="input-field py-2" value={productForm.stock}
                    onChange={e => setProductForm({ ...productForm, stock: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Category *</label>
                  <select className="input-field py-2" value={productForm.category}
                    onChange={e => setProductForm({ ...productForm, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  {
  productForm.category === 'pants' || productForm.category === 'shoes' ? (
    <>
      <label className="label-sm">Sizes (comma separated)</label>
      <div className="flex gap-2 items-center">
        <input
          className="input-field py-2 flex-1"
          placeholder="e.g., 30,32,34"
          value={customSizeInput}
          onChange={e => setCustomSizeInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary px-3 py-1"
          onClick={() => {
            const newSizes = customSizeInput.split(',').map(s => s.trim()).filter(Boolean)
            setProductForm(prev => ({
              ...prev,
              sizes: Array.from(new Set([...prev.sizes, ...newSizes]))
            }))
            setCustomSizeInput('')
          }}
        >Add</button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {productForm.sizes.map(s => (
          <button
            type="button"
            key={s}
            onClick={() => setProductForm(prev => ({ ...prev, sizes: prev.sizes.filter(x => x !== s) }))}
            className="px-2 py-1 rounded text-[10px] font-semibold border bg-red-50 text-red-600"
          >
            {s} ✕
          </button>
        ))}
      </div>
    </>
  ) : productForm.category === 'dresses' ? (
    <>
      {sizeOptions['shirts']?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sizeOptions['shirts'].map(s => (
            <button type="button" key={s}
              onClick={() => setProductForm({ ...productForm, sizes: productForm.sizes.includes(s) ? productForm.sizes.filter(x => x !== s) : [...productForm.sizes, s] })}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${productForm.sizes.includes(s) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <label className="label-sm">Waist Sizes (comma separated)</label>
      <div className="flex gap-2 items-center">
        <input
          className="input-field py-2 flex-1"
          placeholder="e.g., 30,32,34"
          value={customSizeInput}
          onChange={e => setCustomSizeInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary px-3 py-1"
          onClick={() => {
            const newSizes = customSizeInput.split(',').map(s => s.trim()).filter(Boolean)
            setProductForm(prev => ({
              ...prev,
              sizes: Array.from(new Set([...prev.sizes, ...newSizes]))
            }))
            setCustomSizeInput('')
          }}
        >Add</button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {productForm.sizes.map(s => (
          <button
            type="button"
            key={s}
            onClick={() => setProductForm(prev => ({ ...prev, sizes: prev.sizes.filter(x => x !== s) }))}
            className="px-2 py-1 rounded text-[10px] font-semibold border bg-red-50 text-red-600"
          >
            {s} ✕
          </button>
        ))}
      </div>
    </>
  ) : (
    sizeOptions[productForm.category]?.length > 0 && (
      <>
        <label className="label-sm">Sizes</label>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sizeOptions[productForm.category].map(s => (
            <button type="button" key={s}
              onClick={() => setProductForm({ ...productForm, sizes: productForm.sizes.includes(s) ? productForm.sizes.filter(x => x !== s) : [...productForm.sizes, s] })}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${productForm.sizes.includes(s) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </>
    )
  )
}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Upload Image</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-brand-primary hover:file:bg-blue-100 cursor-pointer w-full mt-1.5" 
                  />
                  {uploading && <p className="text-[9px] text-blue-500 mt-0.5">Uploading...</p>}
                  {!uploading && productForm.images[0] && (
                    <p className="text-[9px] text-green-600 mt-0.5 truncate">Uploaded: {productForm.images[0].split('/').pop()}</p>
                  )}
                </div>
                <div>
                  <label className="label-sm">Image URL (Optional)</label>
                  <input className="input-field py-2" placeholder="Or paste https://..." value={productForm.images[0] || ''}
                    onChange={e => setProductForm({ ...productForm, images: [e.target.value] })} />
                </div>
              </div>
              {/* Product Colors & Gallery Selection */}
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="label-sm font-semibold text-gray-700">Colors & Gallery (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setProductForm(prev => ({
                      ...prev,
                      colorImages: [...(prev.colorImages || []), { color: '', image: '' }]
                    }))}
                    className="text-xs text-brand-primary hover:text-brand-primary/80 font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Color
                  </button>
                </div>
                {(productForm.colorImages || []).length === 0 ? (
                  <p className="text-[10px] text-gray-400 italic">No color-specific images added yet.</p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {(productForm.colorImages || []).map((ci, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Color (e.g. Royal Blue)"
                            className="input-field py-1 text-xs"
                            value={ci.color}
                            onChange={e => {
                              const list = [...productForm.colorImages]
                              list[index].color = e.target.value
                              setProductForm({ ...productForm, colorImages: list })
                            }}
                            required
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleColorImageUpload(e, index, 'add')}
                              className="hidden"
                              id={`color-image-add-${index}`}
                            />
                            <label
                              htmlFor={`color-image-add-${index}`}
                              className="btn-outline py-1 px-2 text-[10px] justify-center cursor-pointer block text-center truncate"
                            >
                              {uploadingColorIndex === index ? 'Uploading...' : ci.image ? 'Change' : 'Upload'}
                            </label>
                          </div>
                          {ci.image && (
                            <img src={ci.image} className="w-6 h-6 rounded object-cover border border-gray-200" alt="" />
                          )}
                          <button
                            type="button"
                            onClick={() => setProductForm(prev => ({
                              ...prev,
                              colorImages: prev.colorImages.filter((_, idx) => idx !== index)
                            }))}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Description</label>
                  <textarea className="input-field resize-none text-xs py-2" rows={2} value={productForm.description}
                    onChange={e => setProductForm({ ...productForm, description: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Curator's Note</label>
                  <textarea className="input-field resize-none text-xs py-2" rows={2} value={productForm.curatorNote}
                    onChange={e => setProductForm({ ...productForm, curatorNote: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 btn-outline py-2.5 text-xs">Cancel</button>
                <button type="submit" className="flex-1 btn-primary py-2.5 text-xs justify-center">Add Product</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 w-full max-w-xl my-4">
            <h2 className="font-display text-xl font-bold mb-3">Edit Product</h2>
            <form onSubmit={handleEditProduct} className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Product Name *</label>
                  <input className="input-field py-2" required value={editingProduct.name || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Brand *</label>
                  <input className="input-field py-2" required value={editingProduct.brand || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, brand: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-sm">Price (Rs.) *</label>
                  <input type="number" className="input-field py-2" required value={editingProduct.price || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Original Price</label>
                  <input type="number" className="input-field py-2" value={editingProduct.originalPrice || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, originalPrice: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Stock</label>
                  <input type="number" className="input-field py-2" value={editingProduct.stock || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, stock: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Category *</label>
                  <select className="input-field py-2" value={editingProduct.category || 'shirts'}
                    onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  {
  editingProduct.category === 'pants' || editingProduct.category === 'shoes' ? (
    <>
      <label className="label-sm">Sizes (comma separated)</label>
      <div className="flex gap-2 items-center">
        <input
          className="input-field py-2 flex-1"
          placeholder="e.g., 30,32,34"
          value={editingCustomSizeInput}
          onChange={e => setEditingCustomSizeInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary px-3 py-1"
          onClick={() => {
            const newSizes = editingCustomSizeInput.split(',').map(s => s.trim()).filter(Boolean)
            setEditingProduct(prev => ({
              ...prev,
              sizes: Array.from(new Set([...(prev?.sizes || []), ...newSizes]))
            }))
            setEditingCustomSizeInput('')
          }}
        >Add</button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {editingProduct.sizes?.map(s => (
          <button
            type="button"
            key={s}
            onClick={() => setEditingProduct(prev => ({ ...prev, sizes: prev.sizes.filter(x => x !== s) }))}
            className="px-2 py-1 rounded text-[10px] font-semibold border bg-red-50 text-red-600"
          >
            {s} ✕
          </button>
        ))}
      </div>
    </>
  ) : editingProduct.category === 'dresses' ? (
    <>
      {sizeOptions['shirts']?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sizeOptions['shirts'].map(s => (
            <button type="button" key={s}
              onClick={() => setEditingProduct({ ...editingProduct, sizes: editingProduct.sizes?.includes(s) ? editingProduct.sizes.filter(x => x !== s) : [...(editingProduct.sizes || []), s] })}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${editingProduct.sizes?.includes(s) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <label className="label-sm">Waist Sizes (comma separated)</label>
      <div className="flex gap-2 items-center">
        <input
          className="input-field py-2 flex-1"
          placeholder="e.g., 30,32,34"
          value={editingCustomSizeInput}
          onChange={e => setEditingCustomSizeInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-primary px-3 py-1"
          onClick={() => {
            const newSizes = editingCustomSizeInput.split(',').map(s => s.trim()).filter(Boolean)
            setEditingProduct(prev => ({
              ...prev,
              sizes: Array.from(new Set([...(prev?.sizes || []), ...newSizes]))
            }))
            setEditingCustomSizeInput('')
          }}
        >Add</button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {editingProduct.sizes?.map(s => (
          <button
            type="button"
            key={s}
            onClick={() => setEditingProduct(prev => ({ ...prev, sizes: prev.sizes.filter(x => x !== s) }))}
            className="px-2 py-1 rounded text-[10px] font-semibold border bg-red-50 text-red-600"
          >
            {s} ✕
          </button>
        ))}
      </div>
    </>
  ) : (
    sizeOptions[editingProduct.category]?.length > 0 && (
      <>
        <label className="label-sm">Sizes</label>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {sizeOptions[editingProduct.category].map(s => (
            <button type="button" key={s}
              onClick={() => setEditingProduct({ ...editingProduct, sizes: editingProduct.sizes?.includes(s) ? editingProduct.sizes.filter(x => x !== s) : [...(editingProduct.sizes || []), s] })}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${editingProduct.sizes?.includes(s) ? 'bg-brand-primary text-white border-brand-primary' : 'border-gray-200 text-gray-600'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </>
    )
  )
}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Upload Image</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => handleImageUpload(e, 'edit')} 
                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-brand-primary hover:file:bg-blue-100 cursor-pointer w-full mt-1.5" 
                  />
                  {uploading && <p className="text-[9px] text-blue-500 mt-0.5">Uploading...</p>}
                  {!uploading && editingProduct.images?.[0] && (
                    <p className="text-[9px] text-green-600 mt-0.5 truncate">Uploaded: {editingProduct.images[0].split('/').pop()}</p>
                  )}
                </div>
                <div>
                  <label className="label-sm">Image URL (Optional)</label>
                  <input className="input-field py-2" placeholder="Or paste https://..." value={editingProduct.images?.[0] || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, images: [e.target.value] })} />
                </div>
              </div>
              {/* Product Colors & Gallery Selection */}
              <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="label-sm font-semibold text-gray-700">Colors & Gallery (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(prev => ({
                      ...prev,
                      colorImages: [...(prev.colorImages || []), { color: '', image: '' }]
                    }))}
                    className="text-xs text-brand-primary hover:text-brand-primary/80 font-semibold flex items-center gap-1"
                  >
                    <Plus size={12} /> Add Color
                  </button>
                </div>
                {(!editingProduct.colorImages || editingProduct.colorImages.length === 0) ? (
                  <p className="text-[10px] text-gray-400 italic">No color-specific images added yet.</p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {editingProduct.colorImages.map((ci, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Color (e.g. Royal Blue)"
                            className="input-field py-1 text-xs"
                            value={ci.color}
                            onChange={e => {
                              const list = [...editingProduct.colorImages]
                              list[index].color = e.target.value
                              setEditingProduct({ ...editingProduct, colorImages: list })
                            }}
                            required
                          />
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={e => handleColorImageUpload(e, index, 'edit')}
                              className="hidden"
                              id={`color-image-edit-${index}`}
                            />
                            <label
                              htmlFor={`color-image-edit-${index}`}
                              className="btn-outline py-1 px-2 text-[10px] justify-center cursor-pointer block text-center truncate"
                            >
                              {uploadingColorIndex === index ? 'Uploading...' : ci.image ? 'Change' : 'Upload'}
                            </label>
                          </div>
                          {ci.image && (
                            <img src={ci.image} className="w-6 h-6 rounded object-cover border border-gray-200" alt="" />
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingProduct(prev => ({
                              ...prev,
                              colorImages: prev.colorImages.filter((_, idx) => idx !== index)
                            }))}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Description</label>
                  <textarea className="input-field resize-none text-xs py-2" rows={2} value={editingProduct.description || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} />
                </div>
                <div>
                  <label className="label-sm">Curator's Note</label>
                  <textarea className="input-field resize-none text-xs py-2" rows={2} value={editingProduct.curatorNote || ''}
                    onChange={e => setEditingProduct({ ...editingProduct, curatorNote: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 btn-outline py-2.5 text-xs">Cancel</button>
                <button type="submit" className="flex-1 btn-primary py-2.5 text-xs justify-center">Save Changes</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
