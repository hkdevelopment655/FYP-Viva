import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Package, FileText, CreditCard, CheckCircle, Users, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import Navbar from '../components/layout/Navbar'
import { useAuthStore } from '../context/authStore'
import api from '../services/api'

const WRAPPING_OPTIONS = [
  { id: 'none',    label: 'No Wrapping',    cost: 0,   desc: 'Standard packaging',           color: 'bg-gray-100' },
  { id: 'classic', label: 'Classic',         cost: 150, desc: 'Kraft paper + ribbon',          color: 'bg-amber-50' },
  { id: 'premium', label: 'Premium',         cost: 250, desc: 'Luxury matte box + bow',        color: 'bg-blue-50' },
  { id: 'luxury',  label: 'Luxury',          cost: 350, desc: 'Velvet box + wax seal',         color: 'bg-purple-50' },
]

const ECARD_TEMPLATES = ['birthday', 'wedding', 'graduation', 'eid', 'custom']

// ── Funding progress bar ────────────────────────────────────────────────────
function FundingBar({ raised, target }) {
  const pct = Math.min(100, Math.round((raised / target) * 100))
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm mb-2">
        <span className="font-semibold text-gray-800">Rs. {raised?.toLocaleString()} raised</span>
        <span className="text-gray-500">of Rs. {target?.toLocaleString()}</span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-brand-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1 text-right">{pct}% funded</p>
    </div>
  )
}

// ── Contribution card per member ─────────────────────────────────────────────
function ContributionCard({ c, isMe, onPay }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      c.isPaid ? 'bg-green-50 border-green-200' : isMe ? 'bg-blue-50 border-brand-primary/30' : 'bg-white border-gray-100'
    }`}>
      <div className="w-10 h-10 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-sm">
        {(c.username || c.email)?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm text-gray-800">{c.username || c.email}</p>
        <p className="text-xs text-gray-400">Rs. {c.amount?.toLocaleString()}</p>
      </div>
      {c.isPaid
        ? <CheckCircle size={18} className="text-green-500" />
        : isMe
          ? <button onClick={onPay} className="btn-primary text-xs py-1.5 px-3 rounded-lg">Pay Now</button>
          : <span className="text-xs text-gray-400 font-medium">Pending</span>
      }
    </div>
  )
}

export default function GiftPoolPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [pool, setPool]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [wrapping, setWrapping]   = useState('none')
  const [note, setNote]           = useState('')
  const [noteFrom, setNoteFrom]   = useState('')
  const [eCardEnabled, setECardEnabled] = useState(false)
  const [eCardTemplate, setECardTemplate] = useState('birthday')
  const [savingOptions, setSavingOptions] = useState(false)
  const [customAmount, setCustomAmount]   = useState('')

  useEffect(() => { if (id) fetchPool() }, [id])

  const fetchPool = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/gift-pool/${id}`)
      const p   = res.data.giftPool
      setPool(p)
      setWrapping(p.wrapping?.style || 'none')
      setNote(p.personalNote?.message || '')
      setNoteFrom(p.personalNote?.from || '')
      setECardEnabled(p.eCard?.enabled || false)
      setECardTemplate(p.eCard?.template || 'birthday')
    } catch { toast.error('Gift pool not found') }
    finally { setLoading(false) }
  }

  const isAdmin = (() => {
    if (!user || !pool) return false
    const userId = user._id || user.id
    const adminId = pool?.admin?._id || pool?.admin
    const isPoolAdmin = adminId?.toString() === userId?.toString()
    const isSysAdmin = user.role === 'admin'
    return isPoolAdmin || isSysAdmin
  })()
  const mySlot  = pool?.contributions?.find(c => c.user?._id === user?._id || c.user === user?._id)

  const saveOptions = async () => {
    setSavingOptions(true)
    try {
      await api.put(`/gift-pool/${id}/options`, {
        wrapping:     { style: wrapping, extraCost: WRAPPING_OPTIONS.find(w => w.id === wrapping)?.cost || 0 },
        personalNote: { message: note, from: noteFrom, isShared: true },
        eCard:        { enabled: eCardEnabled, template: eCardTemplate },
      })
      toast.success('Gift options saved!')
      fetchPool()
    } catch { toast.error('Failed to save options') }
    finally { setSavingOptions(false) }
  }

  const payMyShare = async () => {
    try {
      await api.post(`/gift-pool/${id}/contribute`, {
        amount: mySlot?.amount,
        transactionId: `EP-${Date.now()}`   // replace with real Easypaisa txn ID
      })
      toast.success('Contribution recorded!')
      fetchPool()
    } catch (err) { toast.error(err.response?.data?.message || 'Payment failed') }
  }

  const confirmOrder = async () => {
    try {
      await api.post(`/gift-pool/${id}/confirm`)
      toast.success('Gift order placed!')
      navigate('/home')
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to confirm') }
  }

  const TABS = [
    { id: 'overview',      label: 'Overview',       icon: Gift },
    { id: 'wrapping',      label: 'Gift Options',    icon: Package },
    { id: 'note',          label: 'Personal Note',   icon: FileText },
    { id: 'contributions', label: 'Contributions',   icon: Users },
  ]

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        {[1,2,3].map(i => <div key={i} className="shimmer h-24 rounded-2xl" />)}
      </div>
    </div>
  )

  if (!pool) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="card p-7 mb-6">
          <div className="flex items-start gap-5">
            <div className="bg-brand-primary/10 w-14 h-14 rounded-2xl flex items-center justify-center">
              <Gift size={26} className="text-brand-primary" />
            </div>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold text-gray-900">{pool.occasionName}</h1>
              {pool.occasionDate && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Scheduled for {new Date(pool.occasionDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
              <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-semibold ${
                pool.status === 'fully_funded' ? 'bg-green-50 text-green-700' :
                pool.status === 'ordered'      ? 'bg-blue-50 text-blue-700' :
                'bg-amber-50 text-amber-700'
              }`}>
                {pool.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold text-brand-primary">
                Rs. {pool.targetAmount?.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">total goal</p>
            </div>
          </div>

          <div className="mt-6">
            <FundingBar raised={pool.raisedAmount} target={pool.targetAmount} />
          </div>

          {/* Confirm order button for admin */}
          {isAdmin && pool.status === 'fully_funded' && (
            <button onClick={confirmOrder} className="btn-primary w-full justify-center py-3.5 rounded-xl">
              <CheckCircle size={16} /> Confirm Gift Order
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id ? 'bg-brand-primary text-white' : 'bg-white text-gray-500 border hover:text-brand-primary'
              }`}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Overview tab */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="card p-6">
                <h3 className="font-display font-bold text-lg mb-4">Gift Items</h3>
                <div className="space-y-3">
                  {pool.items?.map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                      <img src={item.image || 'https://placehold.co/56x56/e8edf5/1E3A8A?text=Gift'}
                        alt={item.name} className="w-14 h-14 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.size && `Size: ${item.size}`}</p>
                      </div>
                      <p className="text-brand-primary font-semibold text-sm">
                        Rs. {(item.price * (item.quantity || 1)).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t mt-5 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Items total</span>
                    <span>Rs. {pool.items?.reduce((s, i) => s + i.price * (i.quantity || 1), 0).toLocaleString()}</span>
                  </div>
                  {pool.wrapping?.style !== 'none' && (
                    <div className="flex justify-between text-gray-500">
                      <span>Gift wrapping ({pool.wrapping.style})</span>
                      <span>Rs. {pool.wrapping.extraCost?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>Total</span>
                    <span className="text-brand-primary">Rs. {pool.targetAmount?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Wrapping tab */}
          {activeTab === 'wrapping' && (
            <motion.div key="wrapping" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="card p-6">
                <h3 className="font-display font-bold text-lg mb-5">Gift Wrapping</h3>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {WRAPPING_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => isAdmin && setWrapping(opt.id)}
                      disabled={!isAdmin}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        wrapping === opt.id ? 'border-brand-primary bg-brand-bg' : 'border-gray-200 bg-white'
                      } ${!isAdmin ? 'opacity-70 cursor-default' : 'hover:border-brand-primary/50'}`}
                    >
                      <p className="font-semibold text-sm text-gray-800">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      <p className={`text-xs font-bold mt-2 ${wrapping === opt.id ? 'text-brand-primary' : 'text-gray-400'}`}>
                        {opt.cost === 0 ? 'Free' : `+Rs. ${opt.cost}`}
                      </p>
                    </button>
                  ))}
                </div>

                {/* E-card */}
                <div className="border-t pt-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Digital E-Card</p>
                      <p className="text-xs text-gray-400">Send a virtual card along with the gift</p>
                    </div>
                    <button
                      onClick={() => isAdmin && setECardEnabled(!eCardEnabled)}
                      disabled={!isAdmin}
                      className={`w-12 h-6 rounded-full transition-colors relative ${eCardEnabled ? 'bg-brand-primary' : 'bg-gray-200'}`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${eCardEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {eCardEnabled && (
                    <div className="grid grid-cols-3 gap-2">
                      {ECARD_TEMPLATES.map(t => (
                        <button key={t} onClick={() => isAdmin && setECardTemplate(t)}
                          className={`p-2 rounded-lg text-xs capitalize font-semibold border-2 transition-colors ${
                            eCardTemplate === t ? 'border-brand-primary bg-brand-bg text-brand-primary' : 'border-gray-200 text-gray-600'
                          }`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <button onClick={saveOptions} disabled={savingOptions} className="btn-primary w-full justify-center py-3.5 rounded-xl mt-5">
                    {savingOptions ? 'Saving…' : 'Save Gift Options'}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* Note tab */}
          {activeTab === 'note' && (
            <motion.div key="note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="card p-6">
                <h3 className="font-display font-bold text-lg mb-2">Personal Message</h3>
                <p className="text-sm text-gray-500 mb-5">
                  This note will be printed and included with the gift.
                  {pool.personalNote?.isShared && ' All members can contribute to the message.'}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="label-sm">Message (max 500 characters)</label>
                    <textarea
                      className="input-field resize-none"
                      rows={5}
                      maxLength={500}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Write a heartfelt message for the recipient…"
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">{note.length}/500</p>
                  </div>
                  <div>
                    <label className="label-sm">From</label>
                    <input className="input-field" placeholder="e.g. The Class of 2026"
                      value={noteFrom} onChange={e => setNoteFrom(e.target.value)} />
                  </div>
                </div>

                {/* Preview */}
                {(note || noteFrom) && (
                  <div className="mt-5 border border-dashed border-gray-300 rounded-xl p-5 bg-amber-50/40">
                    <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Preview</p>
                    <p className="font-display italic text-gray-700 text-sm leading-relaxed">"{note}"</p>
                    {noteFrom && <p className="text-sm text-gray-500 mt-2 text-right">— {noteFrom}</p>}
                  </div>
                )}

                <button onClick={saveOptions} disabled={savingOptions} className="btn-primary w-full justify-center py-3.5 rounded-xl mt-5">
                  {savingOptions ? 'Saving…' : 'Save Note'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Contributions tab */}
          {activeTab === 'contributions' && (
            <motion.div key="contributions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="card p-6">
                <h3 className="font-display font-bold text-lg mb-2">Contributions</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Mode: <span className="font-semibold capitalize text-brand-primary">{pool.contributionMode}</span>
                  {pool.contributionMode === 'equal' && ` — Rs. ${pool.contributions?.[0]?.amount?.toLocaleString()} each`}
                </p>

                {/* Custom amount input */}
                {pool.contributionMode === 'custom' && mySlot && !mySlot.isPaid && (
                  <div className="bg-blue-50 rounded-xl p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">Set your contribution</p>
                    <div className="flex gap-2">
                      <input type="number" className="input-field flex-1" placeholder="Amount in Rs."
                        value={customAmount} onChange={e => setCustomAmount(e.target.value)} />
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/gift-pool/${id}/custom-amount`, { amount: Number(customAmount) })
                            toast.success('Amount set!'); fetchPool()
                          } catch { toast.error('Failed to set amount') }
                        }}
                        className="btn-primary px-4 py-2 rounded-xl text-sm">
                        Set
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {pool.contributions?.map((c, i) => (
                    <ContributionCard
                      key={i}
                      c={c}
                      isMe={c.user?._id === user?._id || c.user === user?._id}
                      onPay={payMyShare}
                    />
                  ))}
                </div>

                <div className="mt-5 pt-5 border-t text-sm text-gray-500 flex justify-between">
                  <span>{pool.contributions?.filter(c => c.isPaid).length} of {pool.contributions?.length} paid</span>
                  <span className="font-semibold text-brand-primary">
                    Rs. {pool.raisedAmount?.toLocaleString()} / Rs. {pool.targetAmount?.toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
