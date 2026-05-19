import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const { login, isLoading }    = useAuthStore()
  const navigate                = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Invalid credentials')
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/10 mb-4">
            <span className="text-3xl font-display font-bold text-gold">J</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-fg">Janze ERP</h1>
          <p className="text-muted text-sm mt-1">Fashion Retail Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-bg border border-border rounded-lg px-3 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:outline-none focus:border-gold/60 transition-colors pr-10"
              />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gold text-bg rounded-lg py-2.5 text-sm font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            Sign In
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-4">
          Powered by Janze ERP v2.0
        </p>
      </div>
    </div>
  )
}
