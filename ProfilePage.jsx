import { useState, useEffect } from 'react'
import { User, Package, LogOut, Edit3, Save, Trash2, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import { useAuthStore } from '../context/authStore'
import api from '../services/api'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'orders', label: 'Orders', icon: Package },
]

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [editing, setEditing] = useState(false)
  const [orders, setOrders] = useState([])
  const [expandedOrderId, setExpandedOrderId] = useState(null)

  
  const cleanUsername = (username) => {
    if (!username) return ''
    return username.replace(/\s\([^)]+\)$/, '')
  }

  const [form, setForm] = useState({ 
    username: cleanUsername(user?.username), 
    email: user?.email || '' 
  })

  useEffect(() => {
    if (user) {
      setForm({ username: cleanUsername(user.username), email: user.email || '' })
    }
  }, [user])

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders()
  }, [activeTab])

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders/my-orders')
      setOrders(res.data.orders)
    } catch { setOrders([]) }
  }

  const handleSave = async () => {
    try {
      const res = await api.put('/auth/profile', { username: form.username })
      useAuthStore.setState({ user: res.data.user })
      toast.success('Profile updated!')
      setEditing(false)
    } catch { toast.error('Update failed') }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        await api.delete('/auth/profile')
        logout()
        navigate('/login')
        toast.success('Account deleted successfully')
      } catch (err) {
        toast.error('Failed to delete account')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Profile Header */}
        <div className="card p-7 mb-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-brand-primary text-white flex items-center justify-center font-display text-3xl font-bold">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-gray-900">{user?.username}</h1>
            <p className="text-gray-500 text-sm">{user?.email}</p>
            {user?.role === 'admin' && (
              <span className="inline-block mt-1 text-xs bg-brand-primary text-white px-2 py-0.5 rounded-full font-semibold">Admin</span>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={handleDeleteAccount} className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 text-sm">
              <Trash2 size={16} /> Delete Account
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 text-sm">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-brand-primary text-white' : 'bg-white text-gray-500 hover:text-brand-primary border'
              }`}
            >
              <tab.icon size={15} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-7">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-xl font-bold">Personal Information</h2>
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                className="flex items-center gap-2 text-sm text-brand-primary font-semibold hover:underline"
              >
                {editing ? <><Save size={14} /> Save</> : <><Edit3 size={14} /> Edit</>}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-sm">Username</label>
                <input
                  className="input-field"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  disabled={!editing}
                />
              </div>
              <div>
                <label className="label-sm">Email</label>
                <input className="input-field bg-gray-50" value={form.email} disabled />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold text-gray-700 mb-3">Style Preferences</h3>
              <div className="flex flex-wrap gap-2">
                {['Minimalist', 'Classic', 'Streetwear', 'Formal', 'Casual'].map(tag => (
                  <span key={tag} className="bg-brand-bg text-brand-primary text-xs px-3 py-1.5 rounded-full font-semibold">{tag}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {!orders.length ? (
              <div className="card p-10 text-center text-gray-400">
                <Package size={40} className="mx-auto mb-3" />
                <p className="font-display text-lg">No orders yet</p>
                <p className="text-sm mt-1">Your curated selections will appear here</p>
                <button onClick={() => navigate('/collections')} className="btn-primary mt-4 mx-auto justify-center">Start Shopping</button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => {
                  const isExpanded = expandedOrderId === order._id;
                  return (
                    <div key={order._id} className="card p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">Order #{order._id.slice(-8).toUpperCase()}</p>
                          <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-brand-primary font-bold">Rs. {order.totalPrice?.toLocaleString()}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${
                            order.status === 'delivered' ? 'bg-green-50 text-green-600' :
                            order.status === 'shipped' ? 'bg-blue-50 text-blue-600' :
                            order.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                            'bg-yellow-50 text-yellow-600'
                          }`}>{order.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {order.items?.slice(0, 3).map((item, i) => (
                          <img key={i} src={item.image || 'https://placehold.co/48x48'} alt={item.name}
                            className="w-12 h-12 object-cover rounded-lg border border-gray-100" />
                        ))}
                        {order.items?.length > 3 && (
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-500 font-semibold">
                            +{order.items.length - 3}
                          </div>
                        )}
                      </div>

                      {/* Interactive Track Actions */}
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order._id)}
                          className="text-xs font-semibold text-brand-primary hover:text-brand-dark transition-colors flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <><ChevronUp size={14} /> Hide Tracking</>
                          ) : (
                            <><ChevronDown size={14} /> Track Order</>
                          )}
                        </button>
                        <button
                          onClick={() => navigate(`/track-order?id=${order._id}`)}
                          className="text-xs font-semibold text-gray-500 hover:text-brand-primary transition-colors flex items-center gap-1"
                        >
                          <MapPin size={13} /> View Live Map
                        </button>
                      </div>

                      {/* Expanded Tracking Timeline Stepper */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="mt-4 pt-4 border-t border-gray-100 overflow-hidden"
                          >
                            <p className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">
                              Shipment Timeline
                            </p>
                            {order.status === 'cancelled' ? (
                              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-xs font-medium">
                                This order has been cancelled and cannot be tracked.
                              </div>
                            ) : (
                              <div className="flex items-center justify-between relative mt-2 px-1">
                                {/* Connector Line */}
                                <div className="absolute left-6 right-6 top-3.5 h-0.5 bg-gray-100 z-0" />
                                
                                {/* Progress connector line */}
                                <div 
                                  className="absolute left-6 top-3.5 h-0.5 bg-brand-primary z-0 transition-all duration-500" 
                                  style={{ 
                                    width: order.status === 'pending' ? '0%' :
                                           order.status === 'processing' ? '33.33%' :
                                           order.status === 'shipped' ? '66.66%' :
                                           order.status === 'delivered' ? '100%' : '0%' 
                                  }} 
                                />

                                {/* Steps */}
                                {[
                                  { label: 'Placed', index: 0 },
                                  { label: 'Processing', index: 1 },
                                  { label: 'Shipped', index: 2 },
                                  { label: 'Delivered', index: 3 }
                                ].map((step) => {
                                  const getStepStatus = (status, idx) => {
                                    const statusOrder = ['pending', 'processing', 'shipped', 'delivered']
                                    const currentIndex = statusOrder.indexOf(status)
                                    if (currentIndex >= idx) return 'completed'
                                    if (currentIndex + 1 === idx) return 'active'
                                    return 'upcoming'
                                  }

                                  const stepStatus = getStepStatus(order.status, step.index)

                                  return (
                                    <div key={step.label} className="flex flex-col items-center relative z-10 flex-1">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all text-[10px] font-bold ${
                                        stepStatus === 'completed'
                                          ? 'bg-brand-primary border-brand-primary text-white shadow-sm'
                                          : stepStatus === 'active'
                                            ? 'bg-white border-brand-primary text-brand-primary ring-4 ring-brand-primary/10 shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-300'
                                      }`}>
                                        {step.index + 1}
                                      </div>
                                      <span className={`text-[9px] font-bold mt-1.5 ${
                                        stepStatus === 'completed' || stepStatus === 'active' ? 'text-gray-800' : 'text-gray-400'
                                      }`}>{step.label}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>

            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}
