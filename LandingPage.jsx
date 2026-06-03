import { useNavigate } from 'react-router-dom'
import { ArrowRight, MessageSquare, Camera, ShoppingCart, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white font-body">
      {/* Navbar */}
      <nav className="px-8 py-5 flex justify-between items-center">
        <span className="font-display font-bold text-2xl text-brand-primary italic">Smart AI</span>
        <div className="flex gap-4">
          <button onClick={() => navigate('/login')} className="btn-outline text-sm py-2 px-5">Log In</button>
          <button onClick={() => navigate('/register')} className="btn-primary text-sm py-2 px-5">Sign Up</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero-gradient px-8 py-20 text-center">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 bg-white/30 backdrop-blur-sm text-brand-primary text-xs font-semibold tracking-widest uppercase px-5 py-2 rounded-full mb-8">
            <Sparkles size={12} /> Introducing Smart AI Styling
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-brand-dark mb-6">
            Welcome to <span className="italic text-brand-primary">Smart AI</span>
          </h1>
          <p className="text-gray-600 text-lg max-w-lg mx-auto mb-10 leading-relaxed">
            Experience a new era of personal style. Our advanced curation engine analyzes your preferences to discover pieces that perfectly align with your aesthetic identity.
          </p>
          <div className="flex justify-center">
            <motion.button
              onClick={() => navigate('/register')}
              className="btn-primary text-base py-4 px-8 rounded-2xl shadow-lg shadow-brand-primary/30"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              Start shopping with AI <ArrowRight size={18} />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 bg-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: MessageSquare,
              title: 'AI Chatbot',
              desc: 'Your personal stylist and shopping assistant, available 24/7. Converse naturally to refine your look, ask for recommendations, or find the perfect outfit for any occasion.',
            },
            {
              icon: ShoppingCart,
              title: 'Group Cart',
              desc: 'Shop with friends in real-time, no matter the distance. Collaborate on looks, vote on selections, and build a collective wardrobe seamlessly.',
            }
          ].map((f, i) => (
            <motion.div
              key={i}
              className="bg-brand-primary rounded-2xl p-8 text-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
            >
              <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                <f.icon size={22} className="text-white" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-3">{f.title}</h3>
              <p className="text-blue-100 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-dark text-blue-200 text-center py-8 text-sm font-body">
        © {new Date().getFullYear()} Smart AI Platform · Built with MERN Stack · AI-Powered Fashion
      </footer>
    </div>
  )
}
