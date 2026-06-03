import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, X, Chrome } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuthStore } from '../context/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, socialLogin } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Modal configurations
  const [activeModal, setActiveModal] = useState(null) // 'google' | 'facebook' | null
  const [customEmail, setCustomEmail] = useState('')
  const [customName, setCustomName] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) return toast.error('Please fill all fields')
    setLoading(true)
    try {
      const loggedInUser = await login(form.email, form.password)
      toast.success('Welcome back!')
      if (loggedInUser?.role === 'admin') navigate('/admin')
      else navigate('/home')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSocialSubmit = async (provider, email, name, avatar, providerId) => {
    setLoading(true)
    setActiveModal(null)
    try {
      const loggedInUser = await socialLogin(provider, email, name, avatar, providerId)
      toast.success(`Logged in with ${provider === 'google' ? 'Google' : 'Facebook'}!`)
      if (loggedInUser?.role === 'admin') navigate('/admin')
      else navigate('/home')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Social login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      <motion.div
        className="auth-card rounded-3xl p-10 w-full max-w-sm z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-white italic mb-2">Smart AI</h1>
          <p className="text-blue-200 text-sm">Welcome Back. Enter your credentials to continue your scholarly curation.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold tracking-widest uppercase text-blue-200 mb-1.5 block">Email Address</label>
            <input
              type="email"
              className="input-field text-white bg-white/10 border border-white/20 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-white/50"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold tracking-widest uppercase text-blue-200">Password</label>
              <Link to="/reset-password" className="text-xs text-blue-300 hover:text-white transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                className="input-field text-white bg-white/10 border border-white/20 rounded-xl px-4 py-3 w-full focus:outline-none focus:border-white/50 pr-10"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-white text-brand-primary font-semibold py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 mt-2">
            {loading ? 'Signing in…' : (<>Log In <ArrowRight size={16} /></>)}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-blue-400/30" /><span className="text-blue-300 text-xs">OR</span><div className="flex-1 h-px bg-blue-400/30" />
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => setActiveModal('google')}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl flex items-center justify-center gap-3 transition-colors text-sm font-medium border border-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>
          <button 
            onClick={() => setActiveModal('facebook')}
            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl flex items-center justify-center gap-3 transition-colors text-sm font-medium border border-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Continue with Facebook
          </button>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Don't have an account? <Link to="/register" className="text-white font-semibold hover:underline">Sign Up</Link>
        </p>
      </motion.div>

      {/* Social login overlays (Simulated popups) */}
      <AnimatePresence>
        {activeModal && (
          <motion.div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <Chrome size={18} className={activeModal === 'google' ? 'text-blue-500' : 'text-[#1877F2]'} />
                  <span className="font-semibold text-sm text-slate-700">
                    Sign in with {activeModal === 'google' ? 'Google' : 'Facebook'}
                  </span>
                </div>
                <button onClick={() => { setActiveModal(null); setCustomEmail(''); setCustomName(''); }} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <p className="text-xs text-slate-500">
                  To continue, select an account or create a simulated one. This registers or signs you in securely:
                </p>

                {/* Pre-configured profiles */}
                <div className="space-y-2">
                  {[
                    { name: 'Asif Computer', email: 'asifcomputer@gmail.com', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=asif', id: '1122334455' },
                    { name: 'Demo Account', email: 'demo@smartai.com', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=demo', id: '9988776655' }
                  ].map((profile) => (
                    <button
                      key={profile.email}
                      onClick={() => handleSocialSubmit(activeModal, profile.email, profile.name, profile.avatar, profile.id)}
                      className="w-full flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <img src={profile.avatar} alt={profile.name} className="w-10 h-10 rounded-full border bg-blue-50" />
                      <div>
                        <div className="font-semibold text-slate-800 text-sm">{profile.name}</div>
                        <div className="text-xs text-slate-500">{profile.email}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom simulated profile form */}
                <div className="pt-4 border-t space-y-3">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Use custom simulated account</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Display Name"
                      className="text-xs p-2.5 border rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 bg-white"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="text-xs p-2.5 border rounded-lg focus:outline-none focus:border-blue-500 text-slate-800 bg-white"
                      value={customEmail}
                      onChange={e => setCustomEmail(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!customEmail || !customName) return toast.error('Fill in name and email');
                      const randId = Math.floor(Math.random() * 1000000000).toString();
                      const avatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${customName.replace(/\s+/g, '')}`;
                      handleSocialSubmit(activeModal, customEmail, customName, avatar, randId);
                    }}
                    className={`w-full py-2.5 rounded-lg text-white font-medium text-xs transition-colors ${activeModal === 'google' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#1877F2] hover:bg-[#1565C0]'}`}
                  >
                    Simulate & Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
