import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Zap, Square, MessageSquare, Plus, Trash2, Menu, ChevronLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import Navbar from '../components/layout/Navbar'
import ProductCard from '../components/products/ProductCard'
import api from '../services/api'

const SUGGESTIONS = [
  'CURATE A MINIMALIST WARDROBE',
  'EXPLORE MID-CENTURY MODERN',
  'THE ARCHITECTURE OF LUXURY',
  'SHOW ME RED LEVI\'S SHIRTS UNDER RS. 1500',
  'BEST WATCHES FOR OFFICE WEAR',
]

export default function HomePage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [recoReason, setRecoReason] = useState('')
  const [sessionId, setSessionId] = useState(() => Math.random().toString(36).slice(2))
  const [chatHistory, setChatHistory] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Fetch recommendations
  useEffect(() => {
    api.get('/chat/recommendations')
      .then(res => {
        setRecommendations(res.data.recommendations || [])
        setRecoReason(res.data.reasoning || '')
      })
      .catch(() => {})
  }, [])

  // Fetch chat history from DB
  const fetchHistory = async () => {
    try {
      const res = await api.get('/chat/history')
      if (res.data.success) {
        setChatHistory(res.data.chats || [])
      }
    } catch (err) {
      console.error('Error fetching chat history:', err)
    }
  }

  // Load chat history on mount
  useEffect(() => {
    fetchHistory()
  }, [])

  const startNewChat = () => {
    const newId = Math.random().toString(36).slice(2)
    setSessionId(newId)
    setMessages([])
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setLoading(false)
    }
    toast.success('Started a new chat session')
  }

  const handleSelectSession = (session) => {
    setSessionId(session.sessionId)
    if (session.messages) {
      const mapped = session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        products: msg.products || [],
        usedAI: true
      }))
      setMessages(mapped)
    } else {
      setMessages([])
    }
  }

  const handleDeleteSession = async (e, session) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation history?')) return
    try {
      const res = await api.delete(`/chat/session/${session._id}`)
      if (res.data.success) {
        toast.success('Conversation history deleted')
        if (sessionId === session.sessionId) {
          // Reset if active
          const newId = Math.random().toString(36).slice(2)
          setSessionId(newId)
          setMessages([])
        }
        fetchHistory()
      }
    } catch (err) {
      console.error('Error deleting session:', err)
      toast.error('Failed to delete chat session')
    }
  }

  const sendMessage = async (text, options = {}) => {
    const msg = (text || input).trim()
    if (!msg) return

    // Setup cancellation
    abortControllerRef.current = new AbortController()
    
    setInput('')
    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      const res = await api.post('/chat/message', 
        { 
          message: msg, 
          sessionId, 
          history,
          productId: options.productId || null,
          color: options.color || null,
          variantId: options.variantId || null
        },
        { signal: abortControllerRef.current.signal }
      )
      
      const { message: aiMsg, products, meta } = res.data
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiMsg,
        products,
        intent: meta?.intent
      }])
      
      // Update history listing immediately
      fetchHistory()
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        toast.success('Response stopped')
      } else {
        toast.error('Chat service unavailable')
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
      inputRef.current?.focus()
    }
  }

  const stopChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const editPrompt = (index) => {
    const content = messages[index].content
    setInput(content)
    setMessages(prev => prev.slice(0, index))
    inputRef.current?.focus()
  }

  const hasMessages = messages.length > 0

  return (
    <div className="h-screen bg-gray-50 flex flex-col font-body overflow-hidden">
      <Navbar />

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Chat History Sidebar */}
        <div 
          className={`bg-gray-900 border-r border-slate-800 text-slate-200 flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 z-30 ${
            sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
          }`}
        >
          {/* Sidebar Header: New Chat Button */}
          <div className="p-4 border-b border-slate-800">
            <button
              onClick={startNewChat}
              className="w-full bg-brand-primary hover:bg-brand-dark text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-brand-primary/10 transition-all shadow-md shadow-brand-primary/10"
            >
              <Plus size={14} /> New Chat
            </button>
          </div>

          {/* Sidebar Chat Sessions List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-2">
              Recent Conversations
            </div>
            {chatHistory.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-4 text-center">
                No past chats
              </div>
            ) : (
              chatHistory.map((session) => {
                const isActive = sessionId === session.sessionId
                const firstUserMsg = session.messages?.find(m => m.role === 'user')?.content || 'Empty styling chat'
                const displayTitle = firstUserMsg.length > 30 ? firstUserMsg.substring(0, 30) + '...' : firstUserMsg

                return (
                  <div
                    key={session._id}
                    onClick={() => handleSelectSession(session)}
                    className={`group w-full text-left p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${
                      isActive 
                        ? 'bg-slate-800 text-white border-slate-700/60 shadow-lg' 
                        : 'bg-transparent text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare size={14} className={isActive ? 'text-brand-light' : 'text-slate-500'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{displayTitle}</p>
                        <p className="text-[9px] text-slate-600 font-semibold mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSession(e, session)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/15 text-slate-500 hover:text-red-400 transition-all ml-1.5"
                      title="Delete Conversation"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Main Chat View */}
        <div className="flex-1 bg-brand-primary flex flex-col h-full relative overflow-hidden">
          
          {/* Chat Control Top Bar */}
          <div className="bg-brand-dark/20 border-b border-white/5 py-3 px-4 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors"
              title={sidebarOpen ? "Hide Chat History" : "Show Chat History"}
            >
              {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">Stylist Assistant (AARON)</span>
              <span className="text-[10px] text-blue-300 font-mono">Session: #{sessionId.substring(0, 8)}</span>
            </div>
          </div>

          {!hasMessages ? (
            <div className="flex-1 flex flex-col overflow-y-auto">
              {/* Hero Section */}
              <div className="bg-gradient-to-b from-amber-50/60 to-white py-14 px-8 text-center">
                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-light mb-4">
                  Intelligence Redefined
                </p>
                <h1 className="font-display text-4xl md:text-5xl font-bold text-gray-800 mb-2">
                  The Future of Style is
                </h1>
                <h1 className="font-display text-4xl md:text-5xl font-bold italic text-brand-light mb-4">
                  Conversational
                </h1>
                <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
                  An elite curation powered by AARON — your expert AI stylist with access to our live product archive.
                </p>
              </div>

              {/* Recommendations Strip */}
              {recommendations.length > 0 && (
                <div className="bg-white px-8 py-6 border-b border-gray-100 min-h-[250px]">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={14} className="text-brand-primary" />
                      <p className="text-xs font-semibold tracking-widest uppercase text-brand-primary">
                        Curated Looks
                      </p>
                    </div>
                    {recoReason && (
                      <p className="font-display italic text-gray-500 text-xs mb-4">"{recoReason}"</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {recommendations.map(p => <ProductCard key={p._id} product={p} compact />)}
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions Panel */}
              <div className="px-8 py-12 flex flex-col items-center justify-center bg-brand-primary flex-1">
                <div className="w-full max-w-2xl text-center">
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase text-blue-300 mb-6">
                    Start a Styling Session
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-[10px] font-bold tracking-widest text-blue-200 border border-blue-400/30 px-4 py-2.5 rounded-full hover:bg-white/10 transition-colors uppercase"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Conversation Messages List */
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 flex flex-col">
              <div className="flex-1 space-y-6">
                <AnimatePresence>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-2xl w-full">
                        {msg.role === 'user' ? (
                          <div className="flex flex-col items-end group">
                            <div className="chat-user px-5 py-3 max-w-xs text-sm shadow-lg">
                              {msg.content}
                            </div>
                            <button 
                              onClick={() => editPrompt(i)}
                              className="text-[10px] text-blue-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold font-mono"
                            >
                              Edit Prompt
                            </button>
                          </div>
                        ) : (
                          <div className="animate-in fade-in slide-in-from-left-2 duration-500">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Sparkles size={10} className="text-white" />
                              </div>
                              <span className="text-xs text-blue-300 font-semibold">AARON</span>
                            </div>
                            <div className="chat-ai px-5 py-4 max-w-lg mb-4 italic text-sm text-gray-700 shadow-xl">
                              {msg.content}
                            </div>
                              {msg.products?.length > 0 && (
                               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4 w-full">
                                  {msg.products.map(p => (
                                    <div key={p.variantId || p._id} className="flex flex-col items-center w-full bg-white/5 p-2.5 rounded-2xl border border-white/5">
                                      <ProductCard product={p} compact />
                                      <button
                                        onClick={() => sendMessage(`Pair with ${p.name}`, { productId: p._id, color: p.colors?.[0], variantId: p.variantId })}
                                        className="mt-2 text-xs font-semibold text-blue-200 hover:text-white transition-colors flex items-center gap-1 underline decoration-dotted"
                                      >
                                        ✨ Pair with this...
                                      </button>
                                    </div>
                                  ))}
                               </div>
                              )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {loading && (
                  <div className="flex justify-start items-center gap-3">
                    <div className="chat-ai px-5 py-4 flex gap-2 items-center">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          )}

          {/* Sticky Input Bar at Bottom */}
          <div className="sticky bottom-0 bg-brand-primary/95 backdrop-blur-md pt-4 pb-4 px-4 border-t border-white/5 z-20">
            <div className="flex gap-3 bg-white/10 border border-white/5 rounded-2xl p-2 max-w-3xl mx-auto shadow-2xl">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && sendMessage()}
                placeholder="Ask AARON or message..."
                className="flex-1 bg-transparent text-white placeholder-blue-300 px-4 py-2.5 outline-none text-sm"
              />
              {loading ? (
                <button
                  onClick={stopChat}
                  className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition-all shadow-lg flex items-center justify-center shrink-0"
                >
                  <Square size={16} fill="white" />
                </button>
              ) : (
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim()}
                  className="bg-brand-light hover:bg-blue-500 text-white p-3 rounded-xl transition-all disabled:opacity-40 shadow-lg shrink-0"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
