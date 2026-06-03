import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import Navbar from '../components/layout/Navbar'
import api from '../services/api'

export default function GroupCartJoinPage() {
  const { shareLink } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const ACTIVE_GROUP_CART_KEY = 'smart-ai-active-group-cart-id'

  useEffect(() => {
    const joinGroup = async () => {
      try {
        const res = await api.get(`/group-cart/join/${shareLink}`)
        localStorage.setItem(ACTIVE_GROUP_CART_KEY, res.data.groupCart._id)
        toast.success(`Joined ${res.data.groupCart.name}`)
        navigate(`/group-cart/${res.data.groupCart._id}`)
      } catch (err) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          toast.error("Please login with the correct email account to join.");
          navigate('/login'); // Redirect to login page
        } else {
          setError(err.response?.data?.message || 'Unable to join');
          toast.error('Failed to join group');
        }
        setLoading(false);
      }
    }

    if (shareLink) joinGroup()
  }, [shareLink, navigate])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto py-24 px-6 text-center">
        <div className="rounded-[2rem] border border-gray-200 bg-white p-10 shadow-sm">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Joining Group Cart</h1>
          {loading && !error ? (
            <p className="text-sm text-gray-500">Please wait while we add you to the group.</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-6">{error}</p>
              <button
                onClick={() => navigate('/group-cart')}
                className="btn-outline rounded-3xl px-6 py-3 text-sm font-semibold"
              >
                Back to Group Cart
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
