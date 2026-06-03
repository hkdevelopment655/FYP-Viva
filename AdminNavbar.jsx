import { Link, useNavigate } from 'react-router-dom'
import { User, LogOut } from 'lucide-react'
import { useAuthStore } from '../../context/authStore'

export default function AdminNavbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/admin" className="font-display font-bold text-xl text-white italic">
          Smart AI <span className="text-xs bg-brand-primary text-white px-2 py-0.5 rounded ml-2 not-italic uppercase tracking-widest">Admin</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Admin Profile Badge */}
        <div className="text-gray-300 text-sm font-semibold mr-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          {user?.username}
        </div>
        
        {/* Quick Links */}
        
        <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="Logout">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  )
}
