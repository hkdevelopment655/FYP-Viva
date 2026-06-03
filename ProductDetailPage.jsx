import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom' // Added useLocation
import { Camera, ArrowLeft, Users, Star, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Navbar from '../components/layout/Navbar'
import { useCartStore } from '../context/cartStore'
import { useAuthStore } from '../context/authStore'
import api from '../services/api'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation() // ✨ FIX 1: Capture route context state
  const { addItem } = useCartStore()
  const { user } = useAuthStore() // Get logged-in user
  
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState('')
  const [useColorImage, setUseColorImage] = useState(false)
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [sortBy, setSortBy] = useState('recent')
  const [votes, setVotes] = useState({})
  const [visibleReviews, setVisibleReviews] = useState(5)

  const handleVote = (reviewId, type) => {
    setVotes(prev => {
      const reviewVotes = prev[reviewId] || {
        yes: Math.floor((reviewId.charCodeAt(reviewId.length - 1) || 0) % 5),
        no: Math.floor((reviewId.charCodeAt(reviewId.length - 2) || 0) % 2),
        voted: null
      }

      if (reviewVotes.voted === type) {
        return {
          ...prev,
          [reviewId]: {
            ...reviewVotes,
            yes: type === 'yes' ? reviewVotes.yes - 1 : reviewVotes.yes,
            no: type === 'no' ? reviewVotes.no - 1 : reviewVotes.no,
            voted: null
          }
        }
      }

      let yesDiff = 0
      let noDiff = 0
      if (reviewVotes.voted === 'yes') yesDiff = -1
      if (reviewVotes.voted === 'no') noDiff = -1

      return {
        ...prev,
        [reviewId]: {
          ...reviewVotes,
          yes: reviewVotes.yes + (type === 'yes' ? 1 : 0) + yesDiff,
          no: reviewVotes.no + (type === 'no' ? 1 : 0) + noDiff,
          voted: type
        }
      }
    })
  }

  const getReviewVotes = (reviewId) => {
    return votes[reviewId] || {
      yes: Math.floor((reviewId.charCodeAt(reviewId.length - 1) || 0) % 5),
      no: Math.floor((reviewId.charCodeAt(reviewId.length - 2) || 0) % 2),
      voted: null
    }
  }

  const [adminGroupCarts, setAdminGroupCarts] = useState([]) // Store carts where user is Admin

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/products/${id}`)
        const prod = res.data.product
        setProduct(prod)
        setSelectedSize(prod.sizes?.[1] || prod.sizes?.[0] || 'M')
        
        // ✨ FIX 2: Check if color was passed from chat navigation, else use first variant color
        const routedColor = location.state?.selectedColor || new URLSearchParams(location.search).get('color')
        const firstColor = routedColor || prod.colorImages?.[0]?.color || prod.colors?.[0] || ''
        setSelectedColor(firstColor)
        
        // Check if color specific variant image exists
        const hasVariantImage = prod.colorImages?.some(ci => ci.color?.toLowerCase() === firstColor.toLowerCase())
        if (hasVariantImage || prod.colorImages?.[0]?.image) {
          setUseColorImage(true)
        }
      } catch {
        toast.error('Product not found')
        navigate('/collections')
      } finally {
        setLoading(false)
      }
    }
    
    // Fetch user's active group carts and filter only the ones where they are Admin
    const fetchGroupCarts = async () => {
      if (!user) return
      try {
        const res = await api.get('/group-cart')
        const adminCarts = res.data.groupCarts.filter(
          gc => gc.admin?._id === user._id || gc.admin === user._id
        )
        setAdminGroupCarts(adminCarts)
      } catch (e) {
        console.error('Failed to fetch group carts', e)
      }
    }

    fetchProduct()
    fetchGroupCarts()
  }, [id, user, location.state, location.search]) // Added location checks in dependency array

  if (loading) return (
    <div className="min-h-screen bg-gray-50"><Navbar />
      <div className="max-w-5xl mx-auto p-8 grid grid-cols-2 gap-8">
        <div className="shimmer rounded-2xl aspect-square" />
        <div className="space-y-4">
          <div className="shimmer h-10 rounded-xl" /><div className="shimmer h-6 w-24 rounded-lg" /><div className="shimmer h-32 rounded-xl" />
        </div>
      </div>
    </div>
  )

  if (!product) return null

  const categoryLower = product.category?.toLowerCase() || ''
  const isWatchOrAccessory = categoryLower === 'watches' || categoryLower === 'accessories' || categoryLower === 'watch' || categoryLower === 'accessory'

  const handleAddToCart = () => {
    if (!selectedSize && !isWatchOrAccessory) return toast.error('Select a size')
    addItem(product, isWatchOrAccessory ? 'One Size' : selectedSize, selectedColor || product.colors?.[0])
    toast.success('Added to cart!')
  }

  const handleReviewSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      return toast.error('Please add a title')
    }
    if (!comment.trim()) {
      return toast.error('Please write a comment')
    }
    if (comment.trim().length < 15) {
      return toast.error('Review comment must be at least 15 characters long.')
    }
    setSubmittingReview(true)
    try {
      await api.post(`/products/${id}/reviews`, { rating, title, comment })
      toast.success('Review added successfully!')
      setComment('')
      setTitle('')
      setRating(5)
      // Re-fetch product to display new review
      const res = await api.get(`/products/${id}`)
      setProduct(res.data.product)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  // Updated function to handle variant specific image submission
  const handleAddToGroupCart = async (groupCartId) => {
    if (!selectedSize && !isWatchOrAccessory) return toast.error('Select a size')
    
    // Find if there's an image matching the currently selected color
    const colorSpecificImage = product.colorImages?.find(ci => ci.color === selectedColor)?.image
    // Fallback to primary image array or standard placeholder if matching variant image isn't available
    const finalGroupCartImage = colorSpecificImage || product.images?.[0] || 'https://placehold.co/600x600/e8edf5/1E3A8A?text=Product'

    try {
      await api.post(`/group-cart/${groupCartId}/items`, {
        productId: product._id,
        name: product.name,
        image: finalGroupCartImage, // Fixed: Sends variant image if selected
        price: product.price,
        size: isWatchOrAccessory ? 'One Size' : selectedSize,
        color: selectedColor || product.colors?.[0] || '' // Best Practice: Backend context preserve karne ke liye
      })
      toast.success('Added to group cart!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add to group cart')
    }
  }

  const reviews = product.reviews || []
  const totalReviews = reviews.length

  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    : '0.0'

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  reviews.forEach(r => {
    if (distribution[r.rating] !== undefined) {
      distribution[r.rating]++
    }
  })

  const getProcessedReviews = () => {
    let list = [...reviews]
    if (sortBy === 'recent') {
      list.sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()))
    } else if (sortBy === 'highest') {
      list.sort((a, b) => b.rating - a.rating)
    } else if (sortBy === 'lowest') {
      list.sort((a, b) => a.rating - b.rating)
    }
    return list
  }
  const processedReviews = getProcessedReviews()

  const breadcrumbs = ['CATALOG', 'APPAREL', 'CURATED ESSENTIALS']

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-body tracking-widest text-gray-400 mb-8">
          {breadcrumbs.map((b, i) => (
            <span key={b} className="flex items-center gap-2">
              {i > 0 && <span>/</span>}
              <span className={i === breadcrumbs.length - 1 ? 'text-brand-primary font-semibold' : 'hover:text-gray-600 cursor-pointer'}>{b}</span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Images */}
          <div>
            <motion.div
              className="bg-gray-50 rounded-2xl overflow-hidden aspect-square mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <img
                src={(useColorImage && product.colorImages?.find(ci => ci.color?.toLowerCase() === selectedColor?.toLowerCase())?.image) ? product.colorImages.find(ci => ci.color?.toLowerCase() === selectedColor?.toLowerCase()).image : (product.images?.[selectedImage] || 'https://placehold.co/600x600/e8edf5/1E3A8A?text=Product')}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={e => { e.target.src = 'https://placehold.co/600x600/e8edf5/1E3A8A?text=Product' }}
              />
            </motion.div>
            <div className="flex gap-3">
              {product.images?.slice(0, 3).map((img, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedImage(i)
                    setUseColorImage(false)
                  }}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-colors ${(!useColorImage && selectedImage === i) ? 'border-brand-primary' : 'border-gray-200'}`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover"
                    onError={e => { e.target.src = 'https://placehold.co/80x80/e8edf5/1E3A8A?text=Img' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-3">{product.name}</h1>
            <p className="text-brand-primary font-display text-2xl font-semibold mb-6">
              Rs. {product.price?.toLocaleString()}
            </p>

            {/* Curator note */}
            {product.curatorNote && (
              <div className="border-l-4 border-amber-400 bg-amber-50 px-5 py-4 rounded-r-xl mb-6">
                <p className="text-xs font-body font-semibold tracking-widest uppercase text-amber-600 mb-2">Curator's Note</p>
                <p className="font-display italic text-gray-700 text-sm leading-relaxed">"{product.curatorNote}"</p>
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="mb-6">
                <p className="label-sm">Description</p>
                <p className="text-gray-600 text-sm leading-relaxed font-body">
                  {product.description}
                </p>
              </div>
            )}

            {/* Sizes */}
            {!isWatchOrAccessory && (
              <div className="mb-6">
                <p className="label-sm">Select Architecture</p>
                <div className="flex gap-2 flex-wrap">
                  {(product.sizes?.length ? product.sizes : ['S', 'M', 'L', 'XL']).map(size => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`w-12 h-12 rounded-xl font-body font-semibold text-sm border-2 transition-all ${
                        selectedSize === size
                          ? 'bg-brand-primary text-white border-brand-primary'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-brand-primary'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {((product.colors && product.colors.length > 0) || (product.colorImages && product.colorImages.length > 0)) && (
              <div className="mb-6">
                <p className="label-sm">Select Color</p>
                <div className="flex gap-3 flex-wrap">
                  {product.colorImages && product.colorImages.length > 0 ? (
                    product.colorImages.map((ci) => (
                      <button
                        key={ci.color}
                        onClick={() => {
                          setSelectedColor(ci.color)
                          setUseColorImage(true)
                        }}
                        className={`group relative flex flex-col items-center gap-1 p-1 rounded-xl border-2 transition-all ${
                          (useColorImage && selectedColor?.toLowerCase() === ci.color?.toLowerCase())
                            ? 'border-brand-primary bg-blue-50/20'
                            : 'border-gray-200 bg-white hover:border-brand-primary'
                        }`}
                        title={ci.color}
                      >
                        <img
                          src={ci.image}
                          alt={ci.color}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <span className="text-[10px] font-semibold text-gray-600 px-1 max-w-[64px] truncate">
                          {ci.color}
                        </span>
                      </button>
                    ))
                  ) : (
                    product.colors?.map(col => (
                      <button
                        key={col}
                        onClick={() => setSelectedColor(col)}
                        className={`px-3 py-1.5 rounded-xl font-body font-semibold text-xs border-2 transition-all ${
                          selectedColor?.toLowerCase() === col?.toLowerCase()
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-brand-primary'
                        }`}
                      >
                        {col}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleAddToCart}
                className="w-full btn-outline py-4 rounded-xl text-sm"
              >
                ADD TO CART
              </button>

              {/* Only show Group Cart Dropdown if user administers active group carts */}
              {adminGroupCarts.length > 0 && (
                <div className="relative group">
                  <button className="w-full btn-outline py-4 rounded-xl text-sm flex items-center justify-center gap-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-colors">
                    <Users size={16} /> ADD TO GROUP CART
                  </button>
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hidden group-hover:block z-10">
                    {adminGroupCarts.map(gc => (
                      <button 
                        key={gc._id}
                        onClick={() => handleAddToGroupCart(gc._id)}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {gc.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="mt-16 border-t border-gray-100 pt-10">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <MessageSquare size={22} className="text-brand-primary" />
            Customer Reviews ({totalReviews})
          </h2>

          {/* 1. Review Aggregator / Summary Dashboard */}
          {totalReviews > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Average Rating Card */}
              <div className="text-center md:border-r border-gray-200/60 py-2">
                <p className="text-5xl font-display font-extrabold text-gray-900">{avgRating}</p>
                <div className="flex justify-center gap-0.5 my-2 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      fill={Math.round(Number(avgRating)) >= star ? 'currentColor' : 'none'}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 font-medium">Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
              </div>

              {/* Progress Bars (Distribution) */}
              <div className="md:col-span-2 space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = distribution[stars] || 0
                  const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0
                  return (
                    <div key={stars} className="flex items-center gap-3 text-xs">
                      <span className="w-12 text-gray-600 font-semibold flex items-center gap-1">
                        {stars} <Star size={12} className="text-amber-400 fill-amber-400" />
                      </span>
                      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-primary rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-gray-400 font-mono">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Left side: Write a Review Form */}
            <div className="md:col-span-1 bg-gray-50 p-6 rounded-2xl h-fit border border-gray-100">
              <h3 className="font-display font-bold text-gray-900 mb-4 text-sm uppercase tracking-wider">Write a Review</h3>
              {user ? (
                <form onSubmit={handleReviewSubmit} className="space-y-4">
                  <div>
                    <label className="label-sm block mb-1.5">Rating</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="text-amber-400 hover:scale-110 transition-transform"
                        >
                          <Star
                            size={20}
                            fill={(hoverRating || rating) >= star ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-sm block mb-1.5">Title</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Great quality, fits well!"
                      className="input-field text-xs bg-white border border-gray-200"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-sm block mb-1.5">Comment</label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Share your thoughts about this product..."
                      className="input-field text-xs resize-none bg-white border border-gray-200"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="w-full btn-primary py-2.5 text-xs justify-center"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm mb-3">Please sign in to write a review.</p>
                  <Link to="/login" className="btn-outline py-2 px-4 rounded-xl text-xs inline-block">
                    Sign In
                  </Link>
                </div>
              )}
            </div>

            {/* Right side: Reviews List */}
            <div className="md:col-span-2 space-y-6">
              {/* Sorting and Filtering Header */}
              {totalReviews > 0 && (
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reviews ({totalReviews})</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg py-1.5 px-3 bg-white text-gray-700 outline-none focus:border-brand-primary transition-colors cursor-pointer"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="highest">Highest Rated</option>
                      <option value="lowest">Lowest Rated</option>
                    </select>
                  </div>
                </div>
              )}

              {processedReviews.length === 0 ? (
                <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">No reviews yet. Be the first to share your experience!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {processedReviews.slice(0, visibleReviews).map((rev) => (
                    <div key={rev._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                      <div className="flex gap-3 items-start">
                        {/* 3. User Avatar / Initials Circle */}
                        <div className="w-9 h-9 rounded-full bg-brand-primary text-white text-xs flex items-center justify-center font-bold font-display shadow-sm uppercase shrink-0">
                          {rev.username ? rev.username.slice(0, 2) : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900 text-sm">{rev.username}</span>
                              {/* 2. Verified Purchase Badge */}
                              {rev.isVerified && (
                                <span className="inline-flex items-center text-[9px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                  Verified Buyer
                                </span>
                              )}
                            </div>
                            <div className="flex gap-0.5 text-amber-400">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={12}
                                  fill={rev.rating >= star ? 'currentColor' : 'none'}
                                />
                              ))}
                            </div>
                          </div>
                          {/* 3. Minimalist Date Format (e.g. "Jan 12, 2026") */}
                          <span className="text-[10px] text-gray-400 font-body block mt-0.5">
                            {new Date(rev.createdAt || Date.now()).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="pl-12 space-y-1">
                        {rev.title && (
                          <h4 className="font-display font-bold text-gray-900 text-sm">{rev.title}</h4>
                        )}
                        <p className="text-gray-650 text-sm leading-relaxed font-body">
                          {rev.comment}
                        </p>
                      </div>
                      
                      {/* 5. Thumbs Up/Down (Helpful Counter) */}
                      <div className="flex items-center gap-4 pt-2.5 pl-12 border-t border-gray-50 text-xs">
                        <span className="text-gray-400 text-[11px]">Was this review helpful?</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleVote(rev._id, 'yes')}
                            className={`flex items-center gap-1 hover:text-green-600 transition-colors text-[11px] ${
                              getReviewVotes(rev._id).voted === 'yes' ? 'text-green-600 font-bold' : 'text-gray-400'
                            }`}
                          >
                            <ThumbsUp size={12} />
                            <span>Yes ({getReviewVotes(rev._id).yes})</span>
                          </button>
                          <button
                            onClick={() => handleVote(rev._id, 'no')}
                            className={`flex items-center gap-1 hover:text-red-500 transition-colors text-[11px] ${
                              getReviewVotes(rev._id).voted === 'no' ? 'text-red-500 font-bold' : 'text-gray-400'
                            }`}
                          >
                            <ThumbsDown size={12} />
                            <span>No ({getReviewVotes(rev._id).no})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {processedReviews.length > visibleReviews && (
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => setVisibleReviews(prev => prev + 5)}
                        className="btn-outline py-2 px-5 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Load More Reviews
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}