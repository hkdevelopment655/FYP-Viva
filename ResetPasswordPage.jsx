import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import api from '../services/api'

export default function ResetPasswordPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      await api.put(`/auth/reset-password/${token}`, { password: form.password })
      toast.success('Password updated!')
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-4">
      <motion.div
        className="auth-card rounded-3xl p-10 w-full max-w-sm"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="text-center mb-6">
          <h2 className="font-display italic text-xl text-white mb-3">Smart AI</h2>
          <h1 className="font-display text-3xl font-bold text-white mb-2">Reset Your Password</h1>
          <p className="text-blue-200 text-sm">Please enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Email Address', key: 'email', type: 'email' },
            { label: 'New Password', key: 'password', type: 'password' },
            { label: 'Confirm Password', key: 'confirm', type: 'password' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold tracking-widest uppercase text-blue-200 mb-1.5 block">{label}</label>
              <input type={type} className="input-field" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}

          <button type="submit" disabled={loading} className="w-full bg-white text-brand-primary font-semibold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-2">
            {loading ? 'Updating…' : (<>Update Password <ArrowRight size={16} /></>)}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
