import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../context/authStore'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuthStore()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.email || !form.password) return toast.error('Please fill all fields')
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters')
    
    setLoading(true)
    try {
      const loggedInUser = await register(form.username, form.email, form.password)
      toast.success('Account created!')
      
      // Route based on role
      if (loggedInUser?.role === 'admin') {
        navigate('/admin')
      } else {
        navigate('/home')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
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
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white italic">Smart AI</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Username', key: 'username', type: 'text' },
            { label: 'Email Address', key: 'email', type: 'email' },
            { label: 'Password', key: 'password', type: 'password' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold tracking-widest uppercase text-blue-200 mb-1.5 block">
                {label}
              </label>
              <input
                type={type}
                className="input-field"
                value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        {/* Forgot Password Link */}
        <div className="text-right mt-1 mb-3">
          <Link to="/reset-password" className="text-xs text-blue-300 hover:text-white transition-colors">Forgot password?</Link>
        </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-white text-brand-primary font-semibold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {loading ? 'Creating account…' : (<>Sign Up <ArrowRight size={16} /></>)}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-blue-400/30" />
          <span className="text-blue-300 text-xs">OR</span>
          <div className="flex-1 h-px bg-blue-400/30" />
        </div>

        <div className="space-y-3">
          {['Google', 'Facebook'].map(provider => (
            <button 
              key={provider} 
              className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl flex items-center justify-center gap-3 transition-colors text-sm font-medium border border-white/20"
            >
              Continue with {provider}
            </button>
          ))}
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Already have an account? <Link to="/login" className="text-white font-semibold hover:underline">Login</Link>
        </p>
      </motion.div>
    </div>
  )
}