import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi }    from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { useT }       from '../i18n'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const t = useT()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const { setAuth }   = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      setAuth(data.user, data.accessToken, data.refreshToken)
      navigate('/dashboard')
      toast.success(`${t.auth.welcome}, ${data.user.name}!`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? t.auth.invalidCreds)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-gold/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-gold tracking-tight">AVERO × Janze</h1>
          <p className="text-muted text-sm mt-1">Retail ERP System</p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-6">{t.auth.signIn}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">{t.auth.email}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@avero.uz" required
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">{t.auth.password}</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="input"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50"
            >
              {loading ? t.auth.signingIn : t.auth.signIn}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          Default: admin@avero.uz / Admin@1234
        </p>
      </div>
    </div>
  )
}
