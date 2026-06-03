import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, MapPin, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import Navbar from '../components/layout/Navbar'
import { useCartStore } from '../context/cartStore'
import api from '../services/api'
import validator from 'validator'

const STEPS = ['Shipping', 'Payment', 'Confirm']

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, clearCart } = useCartStore()
  const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState(null)
  const [shipping, setShipping] = useState({
    fullName: '', address: '', city: '', postalCode: '', phone: ''
  })
  const [payment, setPayment] = useState({ phone: '', method: '' })
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' })
  const [errors, setErrors] = useState({ name: '', number: '', expiry: '', cvv: '' })

  const validateField = (fieldName, value) => {
    let errMsg = ''
    if (fieldName === 'name') {
      if (validator.isEmpty(value.trim())) {
        errMsg = 'Account holder name is required'
      } else if (!/^[a-zA-Z\s]+$/.test(value)) {
        errMsg = 'Name must contain only letters and spaces'
      }
    } else if (fieldName === 'number') {
      const cleanNum = value.replace(/\s/g, '')
      if (validator.isEmpty(cleanNum)) {
        errMsg = 'Card or account number is required'
      } else if (!validator.isNumeric(cleanNum)) {
        errMsg = 'Number must contain only digits'
      } else {
        const isMobileWallet = cleanNum.length === 11
        const isBankCard = cleanNum.length >= 13 && cleanNum.length <= 19
        const isValidLuhn = cleanNum.length >= 13 ? validator.isCreditCard(cleanNum) : true
        if (!isMobileWallet && !isBankCard) {
          errMsg = 'Must be an 11-digit mobile account or 13-19 digit card'
        } else if (isBankCard && !isValidLuhn) {
          errMsg = 'Invalid credit card number (Luhn check failed)'
        }
      }
    } else if (fieldName === 'expiry') {
      if (validator.isEmpty(value)) {
        errMsg = 'Expiry date is required'
      } else if (!/^\d{2}\/\d{2}$/.test(value)) {
        errMsg = 'Expiry must be in MM/YY format'
      } else {
        const [monthStr, yearStr] = value.split('/')
        const month = parseInt(monthStr, 10)
        if (month < 1 || month > 12) {
          errMsg = 'Expiry month must be between 01 and 12'
        }
      }
    } else if (fieldName === 'cvv') {
      if (validator.isEmpty(value)) {
        errMsg = 'CVV/CVC is required'
      } else if (!validator.isNumeric(value)) {
        errMsg = 'CVV/CVC must be numeric'
      } else if (value.length < 3 || value.length > 4) {
        errMsg = 'CVV/CVC must be 3 or 4 digits'
      }
    }

    setErrors(prev => ({ ...prev, [fieldName]: errMsg }))
    return errMsg
  }

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const parts = []
    for (let i = 0; i < v.length; i += 4) {
      parts.push(v.substring(i, i + 4))
    }
    return parts.join(' ')
  }

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`
    }
    return v
  }

  const queryParams = new URLSearchParams(window.location.search)
  const groupCartId = queryParams.get('groupCartId')
  const [groupCart, setGroupCart] = useState(null)

  useEffect(() => {
    const returnStep = queryParams.get('step')
    const returnOrderId = queryParams.get('orderId')
    if (returnStep === '2' && returnOrderId) {
      setStep(2)
      setOrderId(returnOrderId)
    }
  }, [queryParams])

  useEffect(() => {
    if (groupCartId) {
      const fetchGroupCart = async () => {
        try {
          const res = await api.get(`/group-cart/${groupCartId}`)
          setGroupCart(res.data.groupCart)
          if (res.data.groupCart?.recipient) {
            setShipping({
              fullName: res.data.groupCart.recipient.name || '',
              address: res.data.groupCart.recipient.address || '',
              city: '',
              postalCode: '',
              phone: res.data.groupCart.recipient.phone || ''
            })
          }
        } catch {
          toast.error('Failed to load group cart details')
        }
      }
      fetchGroupCart()
    }
  }, [groupCartId])

  const checkoutItems = groupCartId
    ? [{
        _id: groupCartId,
        product: null,
        name: `${groupCart?.name || 'Group Cart'} - Member Share`,
        image: groupCart?.items?.[0]?.image || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600',
        price: groupCart?.pricePerMember || 0,
        quantity: 1,
        size: 'M'
      }]
    : items;

  const checkoutTotal = groupCartId
    ? (groupCart?.pricePerMember || 0)
    : total;

  const shippingFee = checkoutTotal > 2000 ? 0 : 150
  const grandTotal = checkoutTotal + shippingFee

  const handleShippingSubmit = (e) => {
    e.preventDefault()
    const { fullName, address, city, phone } = shipping
    if (!fullName || !address || !city || !phone) return toast.error('Fill all required fields')
    setStep(1)
  }

  const createOrder = async () => {
    setLoading(true)
    try {
      const res = await api.post('/orders', {
        items: checkoutItems.map(i => ({
          product: i.product || null, name: i.name, image: i.images?.[0] || i.image,
          price: i.price, quantity: i.quantity || 1, size: i.size || 'M'
        })),
        shippingAddress: shipping,
        paymentMethod: payment.method,
        groupCartId
      })
      setOrderId(res.data.order._id)

      if (groupCartId) {
        await api.post(`/group-cart/${groupCartId}/pay-share`)
      }

      return res.data.order._id
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order')
      return null
    } finally {
      setLoading(false)
    }
  }

  // FIXED PAYFAST INTERACTION FLOW
  const handleCardPayment = async (e) => {
    e.preventDefault()

    const nameErr = validateField('name', card.name)
    const numberErr = validateField('number', card.number)
    const expiryErr = validateField('expiry', card.expiry)
    const cvvErr = validateField('cvv', card.cvv)

    if (nameErr || numberErr || expiryErr || cvvErr || !card.name || !card.number || !card.expiry || !card.cvv) {
      return toast.error('Please resolve all validation errors in the card form before proceeding')
    }

    setLoading(true)
    try {
      const oid = await createOrder()
      if (!oid) return
      
      // Hit correct endpoint specified in payment routes
      const response = await api.post('/payment/initiate', { orderId: oid })

      if (response.data.success) {
        const { paymentUrl, payload } = response.data

        // Dynamic hidden form definition matching backend structure completely
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = paymentUrl
        form.style.display = 'none'

        for (const key in payload) {
          if (payload[key] !== undefined && payload[key] !== '') {
            const input = document.createElement('input')
            input.type = 'hidden'
            input.name = key
            input.value = payload[key]
            form.appendChild(input)
          }
        }

        document.body.appendChild(form)
        form.submit()
      } else {
        toast.error('Could not retrieve payment session configuration')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Payment initiation failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePlaceCODOrder = async () => {
    setLoading(true)
    try {
      const oid = await createOrder()
      if (!oid) return
      toast.success('Order placed with Cash on Delivery!')
      setStep(2)
    } catch {
      toast.error('Failed to place order')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = () => {
    if (!groupCartId) {
      clearCart()
    }
    toast.success('Order placed successfully!')
    navigate('/home')
  }

  const handleCancelGroupCheckout = async () => {
    if (!groupCartId) return
    try {
      await api.delete(`/group-cart/${groupCartId}`)
      toast.success('Group checkout cancelled. Group cart removed.')
      navigate('/home')
    } catch {
      toast.error('Failed to cancel group checkout')
    }
  }

  if (!groupCartId && !items.length && step < 2) {
    navigate('/cart')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i <= step ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span className={`ml-2 text-sm font-semibold ${i <= step ? 'text-brand-primary' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && (
                <div className={`mx-4 h-0.5 w-16 transition-colors ${i < step ? 'bg-brand-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div key="ship" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="card p-7"
                >
                  <h2 className="font-display text-xl font-bold mb-6 flex items-center gap-2">
                    <MapPin size={18} className="text-brand-primary" /> Shipping Address
                  </h2>
                  <form onSubmit={handleShippingSubmit} className="space-y-4">
                    <div>
                      <label className="label-sm">Full Name *</label>
                      <input className="input-field" value={shipping.fullName} onChange={e => setShipping({ ...shipping, fullName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label-sm">Street Address *</label>
                      <input className="input-field" value={shipping.address} onChange={e => setShipping({ ...shipping, address: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label-sm">City *</label>
                        <input className="input-field" value={shipping.city} onChange={e => setShipping({ ...shipping, city: e.target.value })} />
                      </div>
                      <div>
                        <label className="label-sm">Postal Code</label>
                        <input className="input-field" value={shipping.postalCode} onChange={e => setShipping({ ...shipping, postalCode: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="label-sm">Phone Number *</label>
                      <input className="input-field" placeholder="03001234567" value={shipping.phone} onChange={e => setShipping({ ...shipping, phone: e.target.value })} />
                    </div>
                    <button type="submit" className="btn-primary w-full justify-center py-3.5 mt-2">Continue to Payment</button>
                  </form>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="pay" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="card p-7"
                >
                  <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
                    Select Payment Method
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                      type="button"
                      onClick={() => setPayment({ ...payment, method: 'cod' })}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        payment.method === 'cod'
                          ? 'border-brand-primary bg-blue-50/50 ring-2 ring-brand-primary/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900 text-sm">Cash on Delivery</span>
                        <input 
                          type="radio" 
                          checked={payment.method === 'cod'} 
                          onChange={() => {}}
                          className="text-brand-primary focus:ring-brand-primary" 
                        />
                      </div>
                      <p className="text-xs text-gray-500">Pay with cash upon delivery of your order.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayment({ ...payment, method: 'card' })}
                      className={`p-5 rounded-2xl border-2 text-left transition-all ${
                        payment.method === 'card'
                          ? 'border-brand-primary bg-blue-50/50 ring-2 ring-brand-primary/20'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900 text-sm">Online Payment</span>
                        <input 
                          type="radio" 
                          checked={payment.method === 'card'} 
                          onChange={() => {}}
                          className="text-brand-primary focus:ring-brand-primary" 
                        />
                      </div>
                      <p className="text-xs text-gray-500">Pay instantly using Credit or Debit Card.</p>
                    </button>
                  </div>

                  {payment.method === '' && (
                    <div>
                      <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl bg-gray-50/50">
                        <p className="text-sm font-medium">Please select a payment method above to proceed.</p>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <button type="button" onClick={() => setStep(0)} className="btn-outline flex-1 py-3">Back</button>
                      </div>
                    </div>
                  )}

                  {payment.method === 'cod' && (
                    <div>
                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 mb-6">
                        <h3 className="font-bold text-gray-900 text-sm mb-1">Cash on Delivery (COD)</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          You will pay the full amount of <span className="font-bold text-brand-primary">Rs. {grandTotal.toLocaleString()}</span> in cash when the courier delivers your package to your doorstep. Please ensure someone is available with the correct amount to receive the delivery.
                        </p>
                      </div>
                      <form onSubmit={(e) => { e.preventDefault(); handlePlaceCODOrder(); }} className="space-y-4">
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setStep(0)} className="btn-outline flex-1 py-3">Back</button>
                          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 justify-center">
                            {loading ? <><Loader size={14} className="animate-spin" /> Placing Order…</> : `Confirm Order (Rs. ${grandTotal.toLocaleString()})`}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {payment.method === 'card' && (
                    <div>
                      <div className="relative w-full max-w-sm mx-auto h-44 bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 rounded-2xl p-5 text-white shadow-xl mb-6 overflow-hidden flex flex-col justify-between select-none">
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-primary/20 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex justify-between items-center z-10">
                          <div className="text-[9px] tracking-widest font-mono opacity-80 uppercase">Smart AI Card</div>
                          <div className="text-xs font-black font-mono italic">VISA</div>
                        </div>
                        <div className="w-9 h-6 bg-amber-400/40 border border-amber-300/30 rounded z-10 my-0.5" />
                        <div className="text-base font-mono tracking-widest z-10 text-center my-0.5">
                          {card.number || '•••• •••• •••• ••••'}
                        </div>
                        <div className="flex justify-between items-end z-10">
                          <div>
                            <div className="text-[7px] uppercase tracking-wider opacity-60 font-mono">Cardholder Name</div>
                            <div className="text-[10px] tracking-wide uppercase truncate max-w-[170px] font-semibold">
                              {card.name || 'Your Name'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[7px] uppercase tracking-wider opacity-60 font-mono text-right">Expires</div>
                            <div className="text-[10px] font-mono font-semibold">
                              {card.expiry || 'MM/YY'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <form onSubmit={handleCardPayment} className="space-y-4">
                        <div>
                          <label className="label-sm">Cardholder Name *</label>
                          <input
                            type="text"
                            required
                            className="input-field py-2"
                            placeholder="JOHN DOE"
                            value={card.name}
                            onChange={e => {
                              const val = e.target.value.toUpperCase()
                              setCard({ ...card, name: val })
                              validateField('name', val)
                            }}
                          />
                          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>
                        <div>
                          <label className="label-sm">Card Number *</label>
                          <input
                            type="text"
                            required
                            maxLength={23}
                            className="input-field py-2 font-mono"
                            placeholder="4444 4444 4444 4444"
                            value={card.number}
                            onChange={e => {
                              const val = formatCardNumber(e.target.value)
                              setCard({ ...card, number: val })
                              validateField('number', val)
                            }}
                          />
                          {errors.number && <p className="text-red-500 text-xs mt-1">{errors.number}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="label-sm">Expiry Date *</label>
                            <input
                              type="text"
                              required
                              maxLength={5}
                              className="input-field py-2 font-mono"
                              placeholder="MM/YY"
                              value={card.expiry}
                              onChange={e => {
                                const val = formatExpiry(e.target.value)
                                setCard({ ...card, expiry: val })
                                validateField('expiry', val)
                              }}
                            />
                            {errors.expiry && <p className="text-red-500 text-xs mt-1">{errors.expiry}</p>}
                          </div>
                          <div>
                            <label className="label-sm">CVV *</label>
                            <input
                              type="password"
                              required
                              maxLength={4}
                              className="input-field py-2 font-mono"
                              placeholder="•••"
                              value={card.cvv}
                              onChange={e => {
                                const val = e.target.value.replace(/[^0-9]/g, '')
                                setCard({ ...card, cvv: val })
                                validateField('cvv', val)
                              }}
                            />
                            {errors.cvv && <p className="text-red-500 text-xs mt-1">{errors.cvv}</p>}
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setStep(0)} className="btn-outline flex-1 py-3">Back</button>
                          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3 justify-center">
                            {loading ? <><Loader size={14} className="animate-spin" /> Processing…</> : `Pay Rs. ${grandTotal.toLocaleString()}`}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="card p-10 text-center"
                >
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                    <CheckCircle size={40} className="text-green-500" />
                  </div>
                  <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
                  {payment.method === 'cod' ? (
                    <>
                      <p className="text-gray-500 mb-2 text-sm">Your order has been successfully placed via Cash on Delivery.</p>
                      <p className="text-xs text-gray-400 mb-8">Please prepare the exact amount of Rs. {grandTotal.toLocaleString()} for cash payment when the package is delivered.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 mb-4 text-sm">Your online payment was successful and order has been processed!</p>
                      <p className="text-xs text-gray-400 mb-8">Thank you for purchasing via Smart AI platform.</p>
                    </>
                  )}
                  {orderId && <p className="text-xs font-mono text-gray-400 mb-6 font-semibold">Order ID: {orderId}</p>}
                  <button onClick={handleConfirm} className="btn-primary mx-auto justify-center px-10">Return to Home</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card p-6 h-fit">
            <h3 className="font-display font-bold text-lg mb-4">Summary</h3>
            <div className="space-y-3 mb-4">
              {checkoutItems.map(i => (
                <div key={`${i._id}-${i.size}`} className="flex items-center gap-3">
                  <img src={i.images?.[0] || i.image || 'https://placehold.co/48x48/e8edf5/1E3A8A?text=P'} alt={i.name}
                    className="w-12 h-12 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{i.name}</p>
                    <p className="text-xs text-gray-400">Size: {i.size} · Qty: {i.quantity || 1}</p>
                  </div>
                  <p className="text-xs font-semibold text-brand-primary">Rs. {(i.price * (i.quantity || 1)).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>Rs. {checkoutTotal.toLocaleString()}</span></div>
              <div className="flex justify-between text-gray-500"><span>Shipping</span><span>{shippingFee === 0 ? 'FREE' : `Rs. ${shippingFee}`}</span></div>
              <div className="flex justify-between font-bold text-base pt-2 border-t">
                <span>Total</span><span className="text-brand-primary">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            </div>
            {groupCartId && step < 2 && (
              <button
                onClick={handleCancelGroupCheckout}
                className="w-full mt-4 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl py-3 text-xs font-bold tracking-wider transition-colors"
              >
                CANCEL & DELETE GROUP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
