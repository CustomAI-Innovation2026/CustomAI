import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Upload, History, Settings, ChevronRight, LogOut, GitCompare, Sun, Moon } from 'lucide-react'
import { useTheme } from '../../lib/theme.jsx'

const navItems = [
  { to: '/app',          icon: LayoutDashboard, label: 'Dashboard',          end: true },
  { to: '/app/upload',   icon: Upload,          label: 'New Scan' },
  { to: '/app/matching', icon: GitCompare,      label: 'Document Matching' },
  { to: '/app/history',  icon: History,         label: 'History' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  return (
    <div
      data-theme={theme}
      className={`theme-root flex h-screen overflow-hidden ${isLight ? 'bg-[#f0f4f8]' : 'bg-slate-950'}`}
    >
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className={`theme-sidebar w-64 flex-shrink-0 flex flex-col border-r transition-colors duration-200
        ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-slate-800/60'}`}>

        {/* Logo + Theme Toggle */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b theme-divider
          ${isLight ? 'border-slate-200' : 'border-slate-800/60'}`}>
          <div className="flex-1 min-w-0">
            <img
              src={isLight ? '/CustomAI/logo-blue.webp' : '/CustomAI/logo-white.png'}
              alt="SCGJWD Logo"
              className="h-8 w-auto object-contain"
            />
            <p className={`text-[10px] mt-1 font-medium tracking-wide ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              DocScan AI · OCR Platform
            </p>
          </div>
          {/* Theme Toggle */}
          <button
            onClick={toggle}
            title={isLight ? 'Switch to Dark' : 'Switch to Light'}
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0
              ${isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-amber-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400'}`}
          >
            {isLight ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? isLight
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={
                    isActive
                      ? isLight ? 'text-brand-600' : 'text-brand-400'
                      : isLight ? 'text-slate-400 group-hover:text-slate-600' : 'text-slate-500 group-hover:text-slate-300'
                  } />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className={isLight ? 'text-brand-400' : 'text-brand-400/60'} />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`p-3 border-t space-y-1 ${isLight ? 'border-slate-200' : 'border-slate-800/60'}`}>
          <button className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full group
            ${isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}>
            <Settings size={16} className={isLight ? 'text-slate-400' : 'text-slate-500 group-hover:text-slate-300'} />
            Settings
          </button>
          <button
            onClick={() => navigate('/')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full group
              ${isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
          >
            <LogOut size={16} className={isLight ? 'text-slate-400' : 'text-slate-500 group-hover:text-slate-300'} />
            Back to Home
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <main className={`flex-1 overflow-y-auto transition-colors duration-200
        ${isLight ? 'bg-[#f0f4f8]' : 'bg-slate-950'}`}>
        <Outlet />
      </main>
    </div>
  )
}
