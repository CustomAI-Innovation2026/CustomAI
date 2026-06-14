import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Upload, History, Settings, Zap, ChevronRight, LogOut
} from 'lucide-react'

const navItems = [
  { to: '/app', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/app/upload', icon: Upload, label: 'New Scan' },
  { to: '/app/history', icon: History, label: 'History' },
]

export default function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-slate-800/60 bg-slate-900/50">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/60">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">DocScan AI</p>
            <p className="text-slate-500 text-xs mt-0.5">OCR Platform</p>
          </div>
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
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-brand-400/60" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/60 space-y-1">
          <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all duration-150 w-full group">
            <Settings size={16} className="text-slate-500 group-hover:text-slate-300" />
            Settings
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-all duration-150 w-full group"
          >
            <LogOut size={16} className="text-slate-500 group-hover:text-slate-300" />
            Back to Home
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
