import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, ArrowLeft, Package, Clock, Truck, CheckCircle2, 
  XCircle, AlertCircle, MapPin, Warehouse, Home, Calendar,
  CreditCard, ShieldCheck, ShoppingBag
} from 'lucide-react'
import api from '../services/api'
import Navbar from '../components/layout/Navbar'

export default function TrackOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const orderIdParam = searchParams.get('id') || ''

  const [orderIdInput, setOrderIdInput] = useState(orderIdParam)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [recentOrders, setRecentOrders] = useState([])
  const [loadingRecent, setLoadingRecent] = useState(false)

  // Fetch recent orders for logged in users
  useEffect(() => {
    const fetchRecentOrders = async () => {
      setLoadingRecent(true)
      try {
        const res = await api.get('/orders/my-orders')
        if (res.data.success) {
          setRecentOrders(res.data.orders.slice(0, 3))
        }
      } catch (err) {
        console.error('Error fetching recent orders:', err)
      } finally {
        setLoadingRecent(false)
      }
    }
    fetchRecentOrders()
  }, [])

  // Fetch order details
  const fetchOrder = async (id) => {
    if (!id || id.trim() === '') return
    setLoading(true)
    setError(null)
    try {
      const res = await api.get(`/orders/${id}`)
      if (res.data.success) {
        setOrder(res.data.order)
      } else {
        setError('Could not retrieve order details.')
      }
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(err.response?.data?.message || 'Order not found. Please verify the ID.')
      setOrder(null)
    } finally {
      setLoading(false)
    }
  }

  // Load order automatically when ID changes in URL
  useEffect(() => {
    if (orderIdParam) {
      setOrderIdInput(orderIdParam)
      fetchOrder(orderIdParam)
    } else {
      setOrder(null)
      setError(null)
    }
  }, [orderIdParam])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (orderIdInput.trim()) {
      setSearchParams({ id: orderIdInput.trim() })
    }
  }

  const handleRecentClick = (id) => {
    setOrderIdInput(id)
    setSearchParams({ id })
  }

  // Map order status to progress values
  const getStatusProgress = (status) => {
    switch (status) {
      case 'pending':
        return { percent: 10, step: 0, text: 'Preparing order at our fulfillment center' }
      case 'processing':
        return { percent: 40, step: 1, text: 'Packaging order & arranging logistics' }
      case 'shipped':
        return { percent: 75, step: 2, text: 'In transit - delivery truck is on its way' }
      case 'delivered':
        return { percent: 100, step: 3, text: 'Delivered successfully!' }
      case 'cancelled':
        return { percent: 0, step: -1, text: 'This order has been cancelled.' }
      default:
        return { percent: 10, step: 0, text: 'Processing' }
    }
  }

  const progressInfo = order ? getStatusProgress(order.status) : { percent: 0, step: 0, text: '' }

  const steps = [
    { label: 'Order Placed', desc: 'We received your order', icon: Clock },
    { label: 'Processing', desc: 'Preparing for dispatch', icon: Package },
    { label: 'Shipped', desc: 'Out for delivery', icon: Truck },
    { label: 'Delivered', desc: 'Arrived at your door', icon: CheckCircle2 }
  ]

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col font-body">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1 bg-brand-primary/10 text-brand-primary text-xs font-semibold px-4 py-1.5 rounded-full mb-3">
            <ShieldCheck size={12} /> Secure Delivery Tracking
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Track Your Package
          </h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
            Enter your order reference ID to see live shipping status and simulated transit routing.
          </p>
        </div>

        {/* Search Bar & Shortcuts Card */}
        <div className="max-w-2xl mx-auto card p-6 md:p-8 mb-8 border border-blue-50/50 bg-white/70 backdrop-blur-sm">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder="Enter 24-character Order ID..."
                className="input-field pl-12 py-3.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary py-3.5 px-6 rounded-xl flex justify-center items-center gap-2 text-sm font-semibold shrink-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Truck size={16} /> Track Shipment
                </>
              )}
            </button>
          </form>

          {/* Quick Select badges for Recent Orders */}
          {recentOrders.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">
                Your Recent Orders:
              </span>
              {recentOrders.map((ro) => (
                <button
                  key={ro._id}
                  onClick={() => handleRecentClick(ro._id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 font-medium ${
                    orderIdParam === ro._id
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-primary/50'
                  }`}
                >
                  #{ro._id.substring(ro._id.length - 8).toUpperCase()} ({ro.status})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-8 flex items-start gap-3 shadow-sm"
          >
            <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="font-semibold text-red-800 text-sm">Tracking Query Failed</h4>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Tracking Details Display */}
        <AnimatePresence mode="wait">
          {order ? (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            >
              {/* Left Column: Live Map & Progress Stepper */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Simulated Transit Map */}
                <div className="card p-6 border border-blue-50 bg-white relative overflow-hidden">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-display text-lg font-bold text-gray-900 flex items-center gap-2">
                      <MapPin size={18} className="text-brand-primary" /> Shipment Routing Map
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-bg text-brand-primary border border-brand-primary/10">
                      Live Simulation
                    </span>
                  </div>

                  {/* Route Canvas */}
                  <div className="relative bg-[#f0f4ff] rounded-2xl h-44 border border-blue-100 flex items-center px-8 md:px-16 overflow-hidden">
                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 opacity-10 dot-pattern" />

                    {/* Warehouse Marker (Left) */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className="bg-white p-3 rounded-2xl border-2 border-brand-primary/20 shadow-md text-brand-primary flex items-center justify-center">
                        <Warehouse size={22} />
                      </div>
                      <span className="absolute top-14 text-xs font-bold text-gray-600 whitespace-nowrap">
                        Warehouse
                      </span>
                      <span className="absolute top-18 text-[10px] text-gray-400">
                        Rawalpindi Hub
                      </span>
                    </div>

                    {/* Path Line */}
                    <div className="flex-1 h-1.5 relative mx-4 bg-gray-200 rounded-full">
                      {/* Completed Path Accent */}
                      <motion.div 
                        className="h-full bg-brand-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressInfo.percent}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      />
                      {/* Dotted path details */}
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-1/4 z-0 pointer-events-none">
                        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-brand-primary/30" />
                        <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-brand-primary/30" />
                      </div>
                    </div>

                    {/* Destination Marker (Right) */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div className={`p-3 rounded-2xl border-2 shadow-md flex items-center justify-center transition-all ${
                        order.status === 'delivered'
                          ? 'bg-emerald-500 border-emerald-600 text-white'
                          : 'bg-white border-brand-primary/20 text-brand-primary'
                      }`}>
                        <Home size={22} />
                      </div>
                      <span className="absolute top-14 text-xs font-bold text-gray-600 whitespace-nowrap text-center">
                        {order.shippingAddress?.city || 'Customer'}
                      </span>
                      <span className="absolute top-18 text-[10px] text-gray-400">
                        Destination
                      </span>
                    </div>

                    {/* Animated Delivery Truck */}
                    {order.status !== 'cancelled' && (
                      <motion.div
                        className="absolute bottom-20 z-20 flex flex-col items-center"
                        initial={{ left: '0%' }}
                        animate={{ left: `calc(${progressInfo.percent}% - 24px)` }}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                      >
                        {/* Truck Indicator Tooltip */}
                        <div className="bg-brand-dark text-white text-[10px] font-semibold px-2 py-1 rounded-md mb-2 shadow-lg relative whitespace-nowrap">
                          {order.status === 'pending' && 'Fulfillment preparing'}
                          {order.status === 'processing' && 'Awaiting dispatch'}
                          {order.status === 'shipped' && 'In transit'}
                          {order.status === 'delivered' && 'Delivered!'}
                          <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-brand-dark" />
                        </div>
                        
                        {/* Truck Badge */}
                        <motion.div 
                          className="bg-brand-primary text-white p-2.5 rounded-full shadow-lg border border-white"
                          animate={order.status === 'shipped' ? { y: [0, -3, 0] } : {}}
                          transition={{ repeat: Infinity, duration: 0.6 }}
                        >
                          <Truck size={18} />
                        </motion.div>
                      </motion.div>
                    )}

                    {/* Floating Cloud Animations */}
                    <motion.div 
                      className="absolute top-6 left-12 text-blue-200/50"
                      animate={{ x: [-20, 400, -20] }}
                      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
                    >
                      ☁️
                    </motion.div>
                    <motion.div 
                      className="absolute top-10 right-16 text-blue-200/50"
                      animate={{ x: [20, -300, 20] }}
                      transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                    >
                      ☁️
                    </motion.div>
                  </div>

                  {/* Summary Status Text */}
                  <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${order.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-brand-primary/10 text-brand-primary'}`}>
                        {order.status === 'cancelled' ? <XCircle size={18} /> : <Package size={18} />}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-medium">Current Status</p>
                        <p className="text-sm font-bold text-gray-800 capitalize">{order.status}</p>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-xs text-gray-400 font-medium">Estimated Delivery</p>
                      <p className="text-sm font-bold text-gray-800">
                        {order.status === 'delivered' 
                          ? `Delivered on ${new Date(order.updatedAt).toLocaleDateString()}`
                          : order.status === 'cancelled'
                            ? 'Cancelled'
                            : '2-4 Business Days'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Progress Stepper Timeline */}
                <div className="card p-6 md:p-8 border border-blue-50 bg-white">
                  <h3 className="font-display text-lg font-bold text-gray-900 mb-6">
                    Timeline Progress
                  </h3>

                  {order.status === 'cancelled' ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-red-800">
                      <XCircle className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">Order Cancelled</p>
                        <p className="text-xs text-red-600 mt-1">This order was cancelled and will not undergo delivery processing. If you have questions, please reach out to customer support.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                      {steps.map((step, idx) => {
                        const Icon = step.icon
                        const isCompleted = progressInfo.step >= idx
                        const isActive = progressInfo.step === idx
                        
                        // Pick milestone details
                        let stepTime = null
                        if (idx === 0) stepTime = order.createdAt
                        if (idx === 1 && order.status !== 'pending') stepTime = order.paidAt || order.updatedAt
                        if (idx === 2 && (order.status === 'shipped' || order.status === 'delivered')) stepTime = order.updatedAt
                        if (idx === 3 && order.status === 'delivered') stepTime = order.deliveredAt || order.updatedAt

                        return (
                          <div key={idx} className="relative flex gap-6 items-start">
                            {/* Step Circle Indicator */}
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-2 relative z-10 transition-all ${
                              isCompleted 
                                ? 'bg-brand-primary border-brand-primary text-white' 
                                : isActive 
                                  ? 'bg-white border-brand-primary text-brand-primary ring-4 ring-brand-primary/10'
                                  : 'bg-white border-gray-200 text-gray-300'
                            }`}>
                              {isCompleted && !isActive ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 pt-1">
                              <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1">
                                <h4 className={`text-sm font-bold ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                                  {step.label}
                                </h4>
                                {stepTime && (
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono">
                                    {new Date(stepTime).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs mt-1 ${isActive ? 'text-brand-primary font-medium' : 'text-gray-500'}`}>
                                {isActive ? progressInfo.text : step.desc}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Order Summary & Checkout Specs */}
              <div className="space-y-6">

                {/* Shipping Details */}
                <div className="card p-6 border border-blue-50 bg-white">
                  <h3 className="font-display text-md font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-gray-400" /> Delivery Address
                  </h3>
                  <div className="space-y-2.5 text-xs text-gray-600">
                    <p className="font-bold text-gray-800 text-sm">{order.shippingAddress?.fullName}</p>
                    <p className="leading-relaxed">{order.shippingAddress?.address}</p>
                    <p>{order.shippingAddress?.city}, {order.shippingAddress?.postalCode}</p>
                    <p className="pt-1.5 font-semibold text-gray-700">Phone: {order.shippingAddress?.phone}</p>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="card p-6 border border-blue-50 bg-white">
                  <h3 className="font-display text-md font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" /> Order Details
                  </h3>
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Order ID</span>
                      <span className="font-mono text-gray-700 font-semibold">{order._id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Date Placed</span>
                      <span className="text-gray-700 font-semibold">{new Date(order.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 font-medium">Payment Mode</span>
                      <span className="text-gray-700 font-semibold capitalize">{order.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-medium">Payment Status</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        order.isPaid 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {order.isPaid ? 'PAID' : 'PENDING'}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex justify-between text-gray-500">
                        <span>Subtotal</span>
                        <span>Rs. {order.subtotal?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Shipping Fee</span>
                        <span>{order.shippingPrice === 0 ? 'Free' : `Rs. ${order.shippingPrice}`}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
                        <span>Grand Total</span>
                        <span className="text-brand-primary">Rs. {order.totalPrice?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items list */}
                <div className="card p-6 border border-blue-50 bg-white">
                  <h3 className="font-display text-md font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-gray-400" /> Package Contents
                  </h3>
                  <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                    {order.items?.map((item, idx) => {
                      const imageSrc = item.image || item.product?.images?.[0] || 'https://via.placeholder.com/150';
                      return (
                        <div key={idx} className="flex gap-3 items-start">
                          <img 
                            src={imageSrc} 
                            alt={item.name} 
                            className="w-12 h-12 object-cover rounded-lg border border-gray-100"
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-gray-800 truncate">{item.name}</h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Size: {item.size || 'N/A'} | Qty: {item.quantity}
                            </p>
                            <p className="text-xs font-semibold text-brand-primary mt-1">
                              Rs. {item.price?.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            </motion.div>
          ) : (
            // Empty placeholder screen
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-md mx-auto text-center py-16 px-6"
            >
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-primary">
                <Package size={36} />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                No Shipment Loaded
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Search with your Order ID or click a recent order badge to retrieve shipment details and see transit animation.
              </p>
              <Link 
                to="/home" 
                className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:text-brand-dark transition-colors"
              >
                <ArrowLeft size={14} /> Back to Store
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
