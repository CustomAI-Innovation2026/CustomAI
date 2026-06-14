import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Upload, History, LogOut, Sun, Moon } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useTheme } from '../../context/ThemeContext.jsx'

function ScgJwdLogo() {
  return (
    <svg width="148" height="44" viewBox="0 0 148 44" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="arc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFA726" />
          <stop offset="100%" stopColor="#F04E23" />
        </linearGradient>
      </defs>
      <text x="2" y="32" fontFamily="'Arial Black',Impact,sans-serif" fontSize="34"
            fontWeight="900" fill="white" letterSpacing="-0.5">SCG</text>
      <path d="M 77 3 Q 92 16 77 32" stroke="url(#arc-grad)" strokeWidth="7"
            fill="none" strokeLinecap="round" />
      <text x="83" y="32" fontFamily="'Arial Black',Impact,sans-serif" fontSize="34"
            fontWeight="900" fill="white" letterSpacing="-0.5">JWD</text>
      <text x="84" y="43" fontFamily="Arial,sans-serif" fontSize="9"
            fill="rgba(255,255,255,0.65)" letterSpacing="2.8">LOGISTICS</text>
    </svg>
  )
}

function DocScanLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
           style={{ background: 'linear-gradient(135deg,#4f54e8,#6171f3)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <div>
        <p className="font-bold text-sm leading-none" style={{ color: 'var(--text-primary)' }}>DocScan AI</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>OCR Platform</p>
      </div>
    </div>
  )
}

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/upload', icon: Upload, label: 'Upload' },
  { to: '/app/history', icon: History, label: 'History' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      <aside className="w-60 flex-shrink-0 flex flex-col border-r"
             style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          {isDark ? <ScgJwdLogo /> : <DocScanLogo />}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'text-brand-400 bg-brand-600/10' : ''}`
              }
              style={({ isActive }) => isActive ? {} : { color: 'var(--text-secondary)' }}
              onMouseEnter={e => { if (!e.currentTarget.classList.contains('text-brand-400')) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!e.currentTarget.classList.contains('text-brand-400')) e.currentTarget.style.background = '' }}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
          <button onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
        <Outlet />
      </main>
    </div>
  )
}
