import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Eye, EyeOff, X, Loader2, User } from 'lucide-react'
import { useTheme } from '../lib/theme.jsx'
import { loginUser, registerUser, resetUserPassword, updateUserPassword, setCurrentUser } from '../lib/auth.js'

// ── Shared Modal wrapper ──────────────────────────────────────────────────────
function Modal({ isLight, onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full max-w-sm rounded-2xl shadow-2xl p-5 ${
          isLight ? 'bg-white' : 'bg-slate-800 border border-slate-700'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>{title}</h3>
          <button onClick={onClose} className={`rounded-lg p-1 transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'}`}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldInput({ label, type = 'text', value, onChange, placeholder, required = true, isLight, showToggle, onToggle, show }) {
  const inputCls = `w-full px-3 py-2 rounded-xl text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
    isLight
      ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300'
      : 'bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500'
  }`
  return (
    <div>
      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
      <div className="relative">
        <input
          type={showToggle ? (show ? 'text' : 'password') : type}
          value={value} onChange={onChange} placeholder={placeholder} required={required}
          className={inputCls + (showToggle ? ' pr-9' : '')}
        />
        {showToggle && (
          <button type="button" onClick={onToggle} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500">
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Register Modal ────────────────────────────────────────────────────────────
function RegisterModal({ isLight, onClose }) {
  const [form, setForm] = useState({ name: '', surname: '', email: '', businessUnit: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.surname || !form.email || !form.businessUnit || !form.password) return setError('All fields are required')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match')
    if (form.password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      await registerUser({ name: form.name, surname: form.surname, email: form.email, businessUnit: form.businessUnit, password: form.password })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <Modal isLight={isLight} onClose={onClose} title="Create Account">
      <div className="text-center py-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${isLight ? 'bg-green-100' : 'bg-green-900/40'}`}>
          <span className="text-green-500 font-bold text-base">✓</span>
        </div>
        <p className={`font-semibold text-sm mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>Account created!</p>
        <p className={`text-xs mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>You can now log in with your email and password.</p>
        <button onClick={onClose} className="btn-primary text-xs px-6 py-2">Back to Login</button>
      </div>
    </Modal>
  )

  return (
    <Modal isLight={isLight} onClose={onClose} title="Create Account">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <FieldInput label="Name" value={form.name} onChange={set('name')} placeholder="First name" isLight={isLight} />
          <FieldInput label="Surname" value={form.surname} onChange={set('surname')} placeholder="Last name" isLight={isLight} />
        </div>
        <FieldInput label="Email" type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" isLight={isLight} />
        <FieldInput label="Business Unit" value={form.businessUnit} onChange={set('businessUnit')} placeholder="e.g. Operations, Finance" isLight={isLight} />
        <FieldInput label="Password" value={form.password} onChange={set('password')} isLight={isLight} showToggle onToggle={() => setShowPw(p => !p)} show={showPw} />
        <FieldInput label="Confirm Password" value={form.confirmPassword} onChange={set('confirmPassword')} isLight={isLight} showToggle onToggle={() => setShowPw(p => !p)} show={showPw} />
        {error && <p className="text-red-500 text-[11px]">{error}</p>}
        <button type="submit" disabled={loading} className="w-full btn-primary text-xs py-2 mt-1 flex items-center justify-center gap-1.5">
          {loading && <Loader2 size={12} className="animate-spin" />}
          Create Account
        </button>
      </form>
    </Modal>
  )
}

// ── Forgot Password Modal ─────────────────────────────────────────────────────
function ForgotPasswordModal({ isLight, onClose }) {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [tempPw, setTempPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleStep1(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const temp = await resetUserPassword(email)
      setTempPw(temp)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Email not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2(e) {
    e.preventDefault()
    setError('')
    if (newPw !== confirmPw) return setError('Passwords do not match')
    if (newPw.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      await updateUserPassword(email, newPw)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const title = step === 1 ? 'Forgot Password' : 'Set New Password'

  if (success) return (
    <Modal isLight={isLight} onClose={onClose} title={title}>
      <div className="text-center py-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${isLight ? 'bg-green-100' : 'bg-green-900/40'}`}>
          <span className="text-green-500 font-bold text-base">✓</span>
        </div>
        <p className={`font-semibold text-sm mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>Password updated!</p>
        <p className={`text-xs mb-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>You can now log in with your new password.</p>
        <button onClick={onClose} className="btn-primary text-xs px-6 py-2">Back to Login</button>
      </div>
    </Modal>
  )

  return (
    <Modal isLight={isLight} onClose={onClose} title={title}>
      {step === 1 ? (
        <form onSubmit={handleStep1} className="space-y-3">
          <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Enter your registered email address. A temporary 8-character password will be generated.
          </p>
          <FieldInput label="Email (Organization)" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" isLight={isLight} />
          {error && <p className="text-red-500 text-[11px]">{error}</p>}
          <button type="submit" disabled={loading} className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5">
            {loading && <Loader2 size={12} className="animate-spin" />}
            Generate Temporary Password
          </button>
        </form>
      ) : (
        <form onSubmit={handleStep2} className="space-y-3">
          <div className={`p-3 rounded-xl border ${isLight ? 'bg-amber-50 border-amber-200' : 'bg-amber-900/20 border-amber-700/40'}`}>
            <p className={`text-[11px] font-medium mb-1.5 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>Your temporary password:</p>
            <p className="text-sm font-mono font-bold tracking-[0.2em] text-amber-600">{tempPw}</p>
            <p className={`text-[11px] mt-1.5 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}>Save this and set a new permanent password below.</p>
          </div>
          <FieldInput label="New Password" value={newPw} onChange={e => setNewPw(e.target.value)} isLight={isLight} showToggle onToggle={() => setShowPw(p => !p)} show={showPw} />
          <FieldInput label="Confirm New Password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} isLight={isLight} showToggle onToggle={() => setShowPw(p => !p)} show={showPw} />
          {error && <p className="text-red-500 text-[11px]">{error}</p>}
          <button type="submit" disabled={loading} className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5">
            {loading && <Loader2 size={12} className="animate-spin" />}
            Set New Password
          </button>
        </form>
      )}
    </Modal>
  )
}

// ── Main Landing / Login Page ─────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await loginUser(email, password)
      setCurrentUser(user)
      navigate('/app')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = `w-full px-3 py-2.5 rounded-2xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/40 ${
    isLight
      ? 'bg-slate-100/80 border-slate-200 text-slate-800 placeholder:text-slate-400'
      : 'bg-slate-700/60 border-slate-600 text-white placeholder:text-slate-500'
  }`

  return (
    <div
      data-theme={theme}
      className="min-h-screen flex flex-col"
      style={{
        background: isLight
          ? 'radial-gradient(ellipse at 15% 15%, rgba(147,197,253,0.45) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(253,186,116,0.35) 0%, transparent 55%), #f8fafc'
          : 'radial-gradient(ellipse at 15% 15%, rgba(37,99,235,0.25) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(194,65,12,0.2) 0%, transparent 55%), #0f172a',
      }}
    >
      {/* Top bar */}
      <header className={`flex items-center justify-between px-6 py-3 border-b ${isLight ? 'border-slate-200/60 bg-white/60' : 'border-white/5 bg-black/10'} backdrop-blur-md`}>
        <div className="flex items-center gap-3">
          <img
            src={isLight ? '/CustomAI/logo-blue.webp' : '/CustomAI/logo-white.png'}
            alt="SCGJWD"
            className="h-7 w-auto object-contain"
          />
          <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'} hidden sm:block`}>
            AI OCR and Data Matching Verification
          </span>
        </div>
        <button
          onClick={toggle}
          className={`p-2 rounded-xl transition-all ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-amber-500' : 'bg-slate-800 hover:bg-slate-700 text-amber-400'}`}
        >
          {isLight ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </header>

      {/* Center — login card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div
          className={`w-full max-w-[320px] rounded-3xl shadow-2xl p-6 ${
            isLight
              ? 'bg-white/90 border border-slate-200/80'
              : 'bg-slate-800/80 border border-slate-700/60 backdrop-blur-xl'
          }`}
        >
          {/* Card header */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLight ? 'bg-slate-100' : 'bg-slate-700'}`}>
              <User size={17} className={isLight ? 'text-slate-400' : 'text-slate-400'} />
            </div>
            <h1 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-800' : 'text-white'}`}>Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Email */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Email (Organization)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div>
              <label className={`block text-xs font-medium mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={inputCls + ' pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-[11px] font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-2 mt-1"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Log In
            </button>
          </form>

          {/* Links */}
          <div className="flex justify-between mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-700/60">
            <button
              onClick={() => setShowForgot(true)}
              className={`text-[11px] font-semibold underline underline-offset-2 transition-colors ${isLight ? 'text-blue-500 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'}`}
            >
              Forgot Password
            </button>
            <button
              onClick={() => setShowRegister(true)}
              className={`text-[11px] font-semibold underline underline-offset-2 transition-colors ${isLight ? 'text-blue-500 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'}`}
            >
              Register account
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRegister && <RegisterModal isLight={isLight} onClose={() => setShowRegister(false)} />}
      {showForgot   && <ForgotPasswordModal isLight={isLight} onClose={() => setShowForgot(false)} />}
    </div>
  )
}
