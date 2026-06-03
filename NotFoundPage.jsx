import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-brand-primary flex flex-col items-center justify-center text-center px-6">
      <h1 className="font-display text-9xl font-bold text-white/20 mb-4">404</h1>
      <h2 className="font-display text-3xl font-bold text-white mb-3">Page Not Found</h2>
      <p className="text-blue-200 mb-8">This curation does not exist in our archive.</p>
      <button onClick={() => navigate('/home')} className="bg-white text-brand-primary font-semibold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors">
        Return Home
      </button>
    </div>
  )
}
