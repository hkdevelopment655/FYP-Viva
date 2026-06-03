import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Users, Plus, X, ArrowLeft, Gift, Copy, CheckCircle, Clock, DollarSign, MessageSquare, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { io } from 'socket.io-client'
import Navbar from '../components/layout/Navbar'
import { useAuthStore } from '../context/authStore'
import api from '../services/api'

export default function GroupCartPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuthStore()

  const ACTIVE_KEY = 'smart-ai-active-group-cart-id'

  const [groupCart,         setGroupCart]         = useState(null)
  const [activeTab,         setActiveTab]         = useState('gifts')
  const [loading,           setLoading]           = useState(false)
  const [form,              setForm]              = useState({ name: '', memberEmail: '', members: [] })
  const [showProductModal,  setShowProductModal]  = useState(false)
  const [products,          setProducts]          = useState([])
  const [pageError,         setPageError]         = useState('')
  const [registeredUsers,   setRegisteredUsers]   = useState([])
  const [messages,          setMessages]          = useState([])
  const [newMessage,        setNewMessage]        = useState('')
  const [showChat,          setShowChat]          = useState(false)
  const [fetchingMessages,  setFetchingMessages]  = useState(false)
  const [userSearchQuery,   setUserSearchQuery]   = useState('')

  useEffect(() => {
    if (!groupCart && !id) {
      const fetchRegisteredUsers = async () => {
        try {
          const res = await api.get('/group-cart/users/all')
          setRegisteredUsers(res.data.users || [])
        } catch {
          toast.error('Failed to load registered users')
        }
      }
      fetchRegisteredUsers()
    }
  }, [groupCart, id])

  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

  // ── Load cart on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      fetchGroupCart()
    } else {
      const storedId = localStorage.getItem(ACTIVE_KEY)
      if (storedId) navigate(`/group-cart/${storedId}`)
    }
  }, [id])

  // ── Socket: live updates ───────────────────────────────────────────────────
  useEffect(() => {
    if (!groupCart?._id) return
    const socket = io(SOCKET_URL)
    socket.emit('join-group', groupCart._id)
    socket.on('cart-updated',    ({ groupCart: gc }) => setGroupCart(gc))
    socket.on('payment-updated', () => fetchGroupCart())          // refresh on payment
    socket.on('member-joined',   ({ member, pricePerMember }) => {
      toast.success(`${member} joined the group!`)
      fetchGroupCart()
    })
    socket.on('new-group-message', (message) => {
      setMessages(prev => {
        if (prev.some(m => m._id === message._id)) return prev
        return [...prev, message]
      })
    })
    return () => socket.disconnect()
  }, [groupCart?._id])

  useEffect(() => {
    if (id) {
      const fetchMessages = async () => {
        setFetchingMessages(true)
        try {
          const res = await api.get(`/group-cart/${id}/messages`)
          setMessages(res.data.messages || [])
        } catch {
          toast.error('Failed to load group messages')
        } finally {
          setFetchingMessages(false)
        }
      }
      fetchMessages()
    } else {
      setMessages([])
    }
  }, [id])

  useEffect(() => {
    if (showChat) {
      const container = document.getElementById('group-chat-messages-container')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
  }, [messages, showChat])

  const fetchGroupCart = async () => {
    try {
      const res = await api.get(`/group-cart/${id}`)
      setGroupCart(res.data.groupCart)
      localStorage.setItem(ACTIVE_KEY, res.data.groupCart._id)
      setPageError('')
    } catch (err) {
      setPageError(err.response?.data?.message || 'Group cart not found')
      localStorage.removeItem(ACTIVE_KEY)
      toast.error(err.response?.data?.message || 'Group cart not found')
    }
  }

  // ── Admin check ────────────────────────────────────────────────────────────
  const isAdmin = (() => {
    if (!user || !groupCart) return false
    const userId  = user._id || user.id
    const adminId = groupCart?.admin?._id || groupCart?.admin
    return adminId?.toString() === userId?.toString() || user.role === 'admin'
  })()

  // ── Derived data ───────────────────────────────────────────────────────────
  const acceptedMembers = groupCart?.members?.filter(m => m.status === 'accepted') ?? []
  const pendingMembers  = groupCart?.members?.filter(m => m.status === 'pending')  ?? []
  const paidCount       = acceptedMembers.filter(m => m.hasPaid).length
  const allPaid         = acceptedMembers.length > 0 && paidCount === acceptedMembers.length
  const totalCollected  = acceptedMembers.reduce((acc, m) => acc + (m.paymentAmount || 0), 0)

  // ── My own member record ───────────────────────────────────────────────────
  const myMember = groupCart?.members?.find(
    m => m.user?._id?.toString() === (user?._id || user?.id)?.toString()
      || m.email === user?.email
  )

  // ── Handlers ───────────────────────────────────────────────────────────────
  const addMemberToForm = () => {
    if (!form.memberEmail.trim()) return
    if (form.members.includes(form.memberEmail)) return toast.error('Already added')
    setForm({ ...form, members: [...form.members, form.memberEmail], memberEmail: '' })
  }

  const createGroup = async () => {
    if (!form.name.trim()) return toast.error('Enter a group name')
    setLoading(true)
    try {
      const res = await api.post('/group-cart', {
        name:         form.name,
        memberEmails: form.members,
      })
      localStorage.setItem(ACTIVE_KEY, res.data.groupCart._id)
      setGroupCart(res.data.groupCart)
      navigate(`/group-cart/${res.data.groupCart._id}`)
      toast.success('Group cart created!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenProductModal = async () => {
    setShowProductModal(true)
    try {
      const res = await api.get('/products?limit=50')
      setProducts(res.data.products || [])
    } catch {
      toast.error('Failed to load products')
    }
  }

  const handleAddProduct = async (product) => {
    try {
      const res = await api.post(`/group-cart/${groupCart._id}/items`, {
        productId: product._id,
        name:      product.name,
        image:     product.images?.[0],
        price:     product.price,
        size:      product.sizes?.[0] || 'M',
      })
      setGroupCart(res.data.groupCart)
      toast.success('Product added!')
      setShowProductModal(false)
    } catch {
      toast.error('Failed to add product')
    }
  }

  const handleRemoveItem = async (itemId) => {
    try {
      const res = await api.delete(`/group-cart/${groupCart._id}/items/${itemId}`)
      setGroupCart(res.data.groupCart)
      toast.success('Item removed')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  const handleMarkPaid = async (memberId) => {
    try {
      const res = await api.patch(`/group-cart/${groupCart._id}/members/${memberId}/paid`)
      setGroupCart(res.data.groupCart)
      toast.success('Payment recorded!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment')
    }
  }

  const confirmOrder = async () => {
    try {
      const res = await api.post(`/group-cart/${groupCart._id}/confirm`)
      setGroupCart(res.data.groupCart)
      toast.success('Order items locked and confirmed! Members can now pay their shares.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm order')
    }
  }

  const cancelGroupCart = async () => {
    if (!window.confirm('Are you sure you want to cancel and delete this group cart?')) return
    try {
      await api.delete(`/group-cart/${groupCart._id}`)
      localStorage.removeItem(ACTIVE_KEY)
      toast.success('Group cart cancelled and removed.')
      navigate('/home')
    } catch {
      toast.error('Failed to cancel group cart')
    }
  }

  const handlePayMyShare = () => {
    if (!groupCart?.isConfirmedByAdmin) {
      return toast.error('You cannot pay your share until the admin confirms and locks the order.')
    }
    navigate(`/checkout?groupCartId=${groupCart._id}`)
  }

  const inviteLink = `${window.location.origin}/group-cart/join/${groupCart?.shareLink}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied to clipboard!");
  };

  const copyShareLink = () => {
    // Ensure 'groupCart.shareLink' available hai
    if (!groupCart?.shareLink) {
      return toast.error('Invite link not available yet!');
    }
    const link = `${window.location.origin}/group-cart/join/${groupCart.shareLink}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  const renderMessageContent = (content, isMe) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all ${isMe ? 'text-white hover:text-gray-200' : 'text-brand-primary hover:text-brand-dark'}`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    try {
      const res = await api.post(`/group-cart/${groupCart._id}/messages`, { content })
      setMessages(prev => {
        if (prev.some(m => m._id === res.data.message._id)) return prev
        return [...prev, res.data.message]
      })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send message')
    }
  }

  const tabs = [
    { id: 'gifts',         label: 'SELECTED GIFTS',   icon: Gift },
    { id: 'contributions', label: 'CONTRIBUTIONS',     icon: DollarSign },
    { id: 'members',       label: 'GROUP MEMBERS',     icon: Users },
  ]

  // ── CREATE GROUP form (no cart loaded yet) ─────────────────────────────────
  if (!groupCart && !id) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto py-16 px-6">
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-8 text-center">Create Group Cart</h1>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-5">
          <div>
            <label className="block text-xs font-semibold tracking-widest text-gray-500 mb-2">GROUP NAME</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Birthday Pool, Wedding Gift…"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold tracking-widest text-gray-500 mb-2">INVITE MEMBERS (optional)</label>
            <div className="flex gap-2">
              <input
                value={form.memberEmail}
                onChange={e => setForm({ ...form, memberEmail: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && addMemberToForm()}
                placeholder="member@email.com"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <button onClick={addMemberToForm}
                className="btn-outline px-4 py-2 rounded-xl text-sm">
                <Plus size={16} />
              </button>
            </div>
            {form.members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.members.map(email => (
                  <button key={email}
                    onClick={() => setForm({ ...form, members: form.members.filter(m => m !== email) })}
                    className="flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-full hover:bg-red-50 hover:text-red-600">
                    {email} <X size={12} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {registeredUsers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold tracking-widest text-gray-500 mb-2">QUICK ADD MEMBERS (WhatsApp Style)</label>
              <div className="mb-2">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={e => setUserSearchQuery(e.target.value)}
                  placeholder="Search members by username or email..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                {(() => {
                  const filtered = registeredUsers.filter(u => 
                    u.username?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                  );
                  if (filtered.length === 0) {
                    return (
                      <p className="text-gray-400 col-span-2 text-center py-4 text-xs font-medium">
                        No members found
                      </p>
                    );
                  }
                  return filtered.map(u => {
                    const isSelected = form.members.includes(u.email);
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setForm({ ...form, members: form.members.filter(m => m !== u.email) })
                          } else {
                            setForm({ ...form, members: [...form.members, u.email] })
                          }
                        }}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs ${
                          isSelected
                            ? 'bg-brand-primary/10 border-brand-primary ring-1 ring-brand-primary font-semibold'
                            : 'bg-white border-gray-100 hover:border-brand-primary/30'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                          isSelected ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-gray-800 font-medium">{u.username}</p>
                          <p className="truncate text-[10px] text-gray-400">{u.email}</p>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          <button onClick={createGroup} disabled={loading}
            className="btn-primary w-full rounded-xl py-3 text-sm justify-center">
            {loading ? 'Creating…' : 'Create Group Cart'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Product picker modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showProductModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowProductModal(false)}>
            <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-display text-xl font-bold text-gray-900">Select Product</h2>
                <button onClick={() => setShowProductModal(false)} className="text-gray-400 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                {products.length === 0 ? (
                  <p className="text-gray-500 col-span-full text-center py-10">No products available.</p>
                ) : products.map(p => (
                  <div key={p._id}
                    className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleAddProduct(p)}>
                    <img src={p.images?.[0] || 'https://placehold.co/100x100'}
                      alt={p.name} className="w-full h-28 object-cover rounded-lg mb-3"/>
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p>
                    <p className="text-brand-primary text-xs font-bold mt-1">Rs. {p.price?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {!groupCart && id && (
        <div className="max-w-3xl mx-auto py-24 px-6 text-center">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
            <p className="text-sm text-gray-500 mb-6">{pageError || 'Unable to load this group cart.'}</p>
            <button onClick={() => navigate('/group-cart')}
              className="btn-outline rounded-3xl px-6 py-3 text-sm font-semibold">
              Back to Group Cart
            </button>
          </div>
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      {groupCart && (
        <div className="flex h-[calc(100vh-65px)]">

          {/* Sidebar */}
          <div className="w-64 bg-white border-r border-gray-100 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <button onClick={() => navigate('/home')}
                className="text-xs text-gray-500 flex items-center gap-1 mb-3 hover:text-brand-primary">
                <ArrowLeft size={12}/> BACK
              </button>
              <h2 className="font-body font-bold text-gray-900 text-sm">{groupCart.name?.toUpperCase()}</h2>
              <p className="text-xs text-gray-400 tracking-widest">GROUP REGISTRY</p>

              {/* Member summary pill */}
              <div className="mt-3 flex gap-2 flex-wrap">
                <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-semibold">
                  {acceptedMembers.length} joined
                </span>
                {pendingMembers.length > 0 && (
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full font-semibold">
                    {pendingMembers.length} pending
                  </span>
                )}
              </div>
            </div>

            <nav className="flex-1 p-3">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-widest mb-1 transition-colors ${
                    activeTab === tab.id ? 'bg-brand-primary text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}>
                  <tab.icon size={14}/>
                  {tab.label}
                </button>
              ))}
              <div className="my-2 border-t border-gray-100"></div>
              <button onClick={() => setShowChat(!showChat)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold tracking-widest mb-1 transition-colors ${
                  showChat ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'text-gray-500 hover:bg-gray-55'
                }`}>
                <div className="flex items-center gap-3">
                  <MessageSquare size={14}/>
                  <span>GROUP CHAT</span>
                </div>
                {messages.length > 0 && !showChat && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                    {messages.length}
                  </span>
                )}
              </button>
            </nav>

            <div className="p-3 border-t border-gray-100 space-y-2">
              {isAdmin && (
                <button onClick={handleOpenProductModal}
                  className="w-full btn-primary py-2.5 rounded-xl text-xs justify-center">
                  <Plus size={14}/> ADD PRODUCT
                </button>
              )}
              <button onClick={copyShareLink}
                className="w-full btn-outline py-2.5 rounded-xl text-xs flex items-center justify-center gap-2">
                <Copy size={12}/> COPY INVITE LINK
              </button>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-8">

            {/* ══ GIFTS TAB ══════════════════════════════════════════════════ */}
            {activeTab === 'gifts' && (
              <div>
                <h3 className="font-body font-semibold text-gray-700 tracking-widest text-xs mb-6">
                  SELECTED GIFTS ({groupCart.items?.length || 0})
                </h3>

                {!groupCart.items?.length ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                    <Gift size={32} className="opacity-30"/>
                    <p className="text-sm tracking-widest">NO ITEMS ADDED YET</p>
                    {isAdmin && (
                      <button onClick={handleOpenProductModal}
                        className="btn-primary py-2 px-5 rounded-xl text-xs mt-2">
                        <Plus size={12}/> Add First Product
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Item list */}
                    {groupCart.items.map(item => (
                      <div key={item._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4 flex items-center gap-5">
                        <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                          {item.image
                            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover"/>
                            : <Gift size={24} className="text-gray-400 m-auto mt-4"/>}
                        </div>
                        <div className="flex-1">
                          <p className="font-body font-semibold text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Size: {item.size}</p>
                        </div>
                        <p className="text-brand-primary font-semibold">Rs. {item.price?.toLocaleString()}</p>
                        {isAdmin && (
                          <button onClick={() => handleRemoveItem(item._id)}
                            className="text-gray-300 hover:text-red-500 transition-colors ml-2">
                            <X size={16}/>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Cost breakdown */}
                    {groupCart.totalPrice > 0 && (
                      <div className="grid grid-cols-2 gap-6 mt-6">
                        {/* Total */}
                        <div className="bg-gray-50 rounded-xl p-5">
                          <h4 className="text-xs font-semibold tracking-widest text-gray-500 mb-4">TOTAL COST</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Products</span>
                              <span>Rs. {groupCart.totalPrice?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Processing Fee</span>
                              <span className="text-green-600">Free</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                              <span>TOTAL</span>
                              <span className="text-brand-primary">Rs. {groupCart.totalPrice?.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Per member split */}
                        <div className="bg-gray-50 rounded-xl p-5 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-semibold tracking-widest text-gray-500 mb-3">
                              EQUAL SPLIT ({acceptedMembers.length} members)
                            </h4>
                            <div className="space-y-2 text-sm">
                              {acceptedMembers.map(m => (
                                <div key={m._id} className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-bold">
                                      {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-gray-600 text-xs">
                                      {m.username || m.email}
                                      {m.user?.toString() === (groupCart.admin?._id?.toString() || groupCart.admin?.toString())
                                        ? ' (Admin)' : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">Rs. {groupCart.pricePerMember?.toLocaleString()}</span>
                                    {m.hasPaid
                                      ? <span className="text-[10px] bg-green-50 text-green-600 font-bold px-2 py-0.5 rounded border border-green-200">Paid</span>
                                      : <span className="text-[10px] bg-yellow-50 text-yellow-600 font-bold px-2 py-0.5 rounded border border-yellow-200">Unpaid</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {myMember && !myMember.hasPaid && (
                            groupCart.isConfirmedByAdmin ? (
                              <button
                                onClick={handlePayMyShare}
                                className="w-full mt-4 btn-primary py-2.5 rounded-xl text-xs justify-center font-bold animate-pulse"
                              >
                                PAY MY SHARE
                              </button>
                            ) : (
                              <div className="w-full mt-4 bg-gray-100 text-gray-500 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-gray-200">
                                <span>🔒 Pay share unlocks after admin confirms</span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Confirm / Cancel */}
                    {isAdmin && groupCart.items?.length > 0 && (
                      <div className="mt-6 space-y-3">
                        {groupCart.isConfirmedByAdmin ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col gap-2">
                            <p className="text-xs text-green-750 font-semibold flex items-center gap-1.5">
                              <CheckCircle size={14} className="text-green-600"/>
                              Gift selection confirmed and locked! Members can now pay their share.
                            </p>
                            <button onClick={cancelGroupCart} className="w-full btn-outline py-2.5 rounded-xl text-xs">
                              CANCEL ORDER & DELETE GROUP
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-4">
                            <button onClick={confirmOrder}
                              className="flex-1 bg-brand-primary hover:bg-brand-dark text-white py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                              <CheckCircle size={16}/>
                              CONFIRM ORDER & START PAYMENTS
                            </button>
                            <button onClick={cancelGroupCart} className="flex-1 btn-outline py-4 rounded-xl text-sm">
                              CANCEL ORDER
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ══ CONTRIBUTIONS TAB ══════════════════════════════════════════ */}
            {activeTab === 'contributions' && (
              <div>
                <h3 className="font-body font-semibold text-gray-700 tracking-widest text-xs mb-6">
                  PAYMENT CONTRIBUTIONS
                </h3>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
                    <p className="text-2xl font-bold text-brand-primary">
                      Rs. {groupCart.pricePerMember?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-gray-500 tracking-widest mt-1">PER MEMBER</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
                    <p className="text-2xl font-bold text-green-600">
                      Rs. {totalCollected.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 tracking-widest mt-1">COLLECTED</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
                    <p className="text-2xl font-bold text-gray-700">
                      Rs. {Math.max(0, groupCart.totalPrice - totalCollected).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 tracking-widest mt-1">REMAINING</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{paidCount} of {acceptedMembers.length} paid</span>
                    <span>{acceptedMembers.length > 0 ? Math.round((paidCount / acceptedMembers.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-green-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${acceptedMembers.length > 0 ? (paidCount / acceptedMembers.length) * 100 : 0}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}/>
                  </div>
                </div>

                {/* Per-member payment rows */}
                <div className="space-y-3">
                  {acceptedMembers.map(m => {
                    const isMe = m.user?._id?.toString() === (user?._id || user?.id)?.toString()
                    return (
                      <div key={m._id}
                        className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm ${
                          m.hasPaid ? 'bg-green-500' : 'bg-brand-primary'
                        }`}>
                          {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                        </div>

                        {/* Name */}
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-800">
                            {m.username || m.email} {isMe ? <span className="text-brand-primary">(you)</span> : ''}
                          </p>
                          <p className="text-xs text-gray-400">{m.email}</p>
                        </div>

                        {/* Amount */}
                        <p className="font-semibold text-sm w-28 text-right">
                          Rs. {groupCart.pricePerMember?.toLocaleString()}
                        </p>

                        {/* Status / mark paid button */}
                        {m.hasPaid ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                            <CheckCircle size={12}/> PAID
                          </span>
                        ) : isAdmin ? (
                          <button onClick={() => handleMarkPaid(m._id)}
                            className="text-xs font-semibold text-brand-primary border border-brand-primary px-3 py-1.5 rounded-full hover:bg-brand-bg transition-colors">
                            MARK PAID
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full">
                            <Clock size={12}/> PENDING
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* My payment info box */}
                {myMember && (
                  <div className={`mt-6 rounded-xl p-5 border ${
                    myMember.hasPaid
                      ? 'bg-green-50 border-green-200'
                      : !groupCart.isConfirmedByAdmin
                        ? 'bg-gray-50 border-gray-200 text-gray-500'
                        : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {myMember.hasPaid
                            ? '✅ Your payment of Rs. ' + groupCart.pricePerMember?.toLocaleString() + ' has been recorded.'
                            : !groupCart.isConfirmedByAdmin
                              ? '🔒 Share payment locked.'
                              : '⏳ Your share is Rs. ' + groupCart.pricePerMember?.toLocaleString() + ' is pending.'}
                        </p>
                        {!myMember.hasPaid && (
                          <p className="text-xs text-gray-500 mt-1">
                            {!groupCart.isConfirmedByAdmin
                              ? 'Awaiting the admin to finalize and lock the gift selection.'
                              : 'Please click the button to pay your share independently on the checkout page.'}
                          </p>
                        )}
                      </div>
                      {!myMember.hasPaid && groupCart.isConfirmedByAdmin && (
                        <button
                          onClick={handlePayMyShare}
                          className="btn-primary py-2.5 px-5 rounded-xl text-xs font-bold whitespace-nowrap animate-pulse"
                        >
                          PAY MY SHARE
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ MEMBERS TAB ════════════════════════════════════════════════ */}
            {activeTab === 'members' && (
              <div>
                <h3 className="font-body font-semibold text-gray-700 tracking-widest text-xs mb-6">
                  GROUP MEMBERS ({groupCart.members?.length || 0})
                </h3>

                {/* Accepted members */}
                {acceptedMembers.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs text-green-700 font-semibold tracking-widest mb-3">
                      JOINED ({acceptedMembers.length})
                    </p>
                    <div className="space-y-3">
                      {acceptedMembers.map(m => (
                        <div key={m._id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
                            {m.username?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">
                              {m.username || m.email}
                              {m.user?.toString() === (groupCart.admin?._id?.toString() || groupCart.admin?.toString())
                                ? <span className="ml-2 text-xs text-brand-primary font-normal">(Admin)</span> : ''}
                            </p>
                            <p className="text-xs text-gray-400">{m.email}</p>
                          </div>
                          <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            m.hasPaid ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50'
                          }`}>
                            <CheckCircle size={11}/> {m.hasPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending invites */}
                {pendingMembers.length > 0 && (
                  <div>
                    <p className="text-xs text-yellow-700 font-semibold tracking-widest mb-3">
                      PENDING INVITE ({pendingMembers.length})
                    </p>
                    <div className="space-y-3">
                      {pendingMembers.map(m => (
                        <div key={m._id} className="bg-white rounded-xl border border-yellow-100 shadow-sm p-4 flex items-center gap-4 opacity-80">
                          <div className="w-10 h-10 rounded-full bg-yellow-200 text-yellow-700 flex items-center justify-center font-bold text-sm">
                            {m.email?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-gray-600">{m.email}</p>
                            <p className="text-xs text-yellow-600">Invite sent — waiting to join</p>
                          </div>
                          <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-200">
                            <Clock size={11}/> Pending
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Pending members are not included in the payment split until they join.
                    </p>
                  </div>
                )}

                {groupCart?.shareLink && (
                  <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest text-left">
                      Share Invite Link
                    </label>
                    
                    {/* Yahan clickable link show hoga */}
                    <div className="mb-3 text-left">
                      <a 
                        href={`${window.location.origin}/group-cart/join/${groupCart?.shareLink}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-brand-primary text-sm font-semibold underline break-all hover:text-brand-dark"
                      >
                        {`${window.location.origin}/group-cart/join/${groupCart?.shareLink}`}
                      </a>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const fullLink = `${window.location.origin}/group-cart/join/${groupCart?.shareLink}`;
                          navigator.clipboard.writeText(fullLink);
                          toast.success("Link copied!");
                        }}
                        className="bg-brand-primary text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors"
                      >
                        Copy Link
                      </button>
                    </div>

                    <a 
                      href={`https://wa.me/?text=${encodeURIComponent(`Join my Group Cart: ${window.location.origin}/group-cart/join/${groupCart?.shareLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 block text-green-600 text-[10px] font-bold uppercase underline text-left"
                    >
                      Or share directly on WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Chat Panel */}
          {showChat && (
            <div className="w-80 bg-white border-l border-gray-100 flex flex-col h-full shadow-lg relative z-10 animate-fade-in">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div>
                  <h3 className="font-body font-bold text-gray-900 text-xs tracking-wider">GROUP CHAT</h3>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{groupCart.members?.length} members active</p>
                </div>
                <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-gray-650 transition-colors">
                  <X size={16}/>
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50" id="group-chat-messages-container">
                {fetchingMessages ? (
                  <div className="flex items-center justify-center h-full text-xs text-gray-400 font-semibold">
                    Loading chat history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-400 gap-2">
                    <MessageSquare size={24} className="opacity-30" />
                    <p className="text-xs font-semibold tracking-wider">NO MESSAGES YET</p>
                    <p className="text-[10px] text-gray-450 leading-relaxed font-semibold">Start the conversation with your group members here!</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.sender?._id?.toString() === (user?._id || user?.id)?.toString()
                    const senderName = msg.sender?.username || msg.sender?.email || 'Unknown Member'
                    const avatarLetter = senderName[0]?.toUpperCase()
                    
                    const showSenderName = index === 0 || messages[index - 1].sender?._id !== msg.sender?._id

                    return (
                      <div key={msg._id || index} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        {!isMe && showSenderName ? (
                          <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm">
                            {avatarLetter}
                          </div>
                        ) : (
                          <div className="w-8 h-8 flex-shrink-0" />
                        )}

                        <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : ''}`}>
                          <span className="text-[10px] text-gray-400 font-semibold mx-1 mb-0.5">
                            {senderName}
                          </span>
                          <div className={`p-3 rounded-2xl text-xs shadow-sm leading-relaxed ${
                            isMe 
                              ? 'bg-brand-primary text-white rounded-tr-none' 
                              : 'bg-white text-gray-800 border border-gray-150 rounded-tl-none'
                          }`}>
                            <p className="break-words">{renderMessageContent(msg.content, isMe)}</p>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 px-1 font-medium">
                            {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white">
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand-primary bg-gray-50"
                  />
                  <button type="submit" disabled={!newMessage.trim()}
                    className="bg-brand-primary text-white p-2 rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send size={14}/>
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}
    </div>
  )
}