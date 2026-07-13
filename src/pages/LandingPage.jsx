import { useNavigate } from 'react-router-dom'
import {
  Zap, FileText, Brain, Database, ArrowRight, CheckCircle,
  Upload, Cpu, BarChart3, Shield, Clock, Star, ChevronRight, Github, Sun, Moon
} from 'lucide-react'
import { useTheme } from '../lib/theme.jsx'

const FEATURES = [
  {
    icon: Upload,
    title: 'Drag & Drop Upload',
    desc: 'Upload PDF, PNG, JPG invoices instantly. Supports batch processing up to 50 files.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Brain,
    title: 'AI-Powered OCR',
    desc: 'GPT-4o vision extracts every field — vendor, date, total, tax, line items — with 99%+ accuracy.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Zap,
    title: 'n8n Automation',
    desc: 'Your n8n workflow orchestrates the AI pipeline. Swap LLMs, add steps, zero code changes.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Database,
    title: 'Supabase Storage',
    desc: 'All documents and extracted data live in your Supabase project. Real-time updates via WebSockets.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: BarChart3,
    title: 'Export & Analytics',
    desc: 'Export structured data as JSON, CSV, or push directly to your ERP or accounting system.',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    desc: 'Row-level security on every table. Files encrypted at rest. No data leaves your infrastructure.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
]

const STEPS = [
  { num: '01', title: 'Upload Document', desc: 'Drop any invoice, receipt, or purchase order.' },
  { num: '02', title: 'n8n Processes', desc: 'Your automation pipeline validates and routes to LLM.' },
  { num: '03', title: 'AI Extracts Data', desc: 'GPT-4o vision reads every field with structured output.' },
  { num: '04', title: 'Review & Export', desc: 'Confirm results, edit if needed, export as CSV/JSON.' },
]

const STATS = [
  { value: '99.2%', label: 'Extraction Accuracy' },
  { value: '<15s', label: 'Avg Processing Time' },
  { value: '50+', label: 'Document Types' },
  { value: '∞', label: 'Monthly Documents' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className="min-h-screen gradient-mesh font-sans">
      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={isLight ? '/CustomAI/logo-blue.webp' : '/CustomAI/logo-white.png'}
              alt="SCGJWD Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#stats" className="hover:text-white transition-colors">Stats</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggle}
              title={isLight ? 'Switch to Dark' : 'Switch to Light'}
              className={`p-2 rounded-lg transition-all duration-200
                ${isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400'}`}
            >
              {isLight ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a
              href="https://github.com/wallapsu-data/CustomAI"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Github size={16} />
              <span className="hidden sm:inline">GitHub</span>
            </a>
            <button
              onClick={() => navigate('/app/upload')}
              className="btn-primary text-sm py-2 px-4"
            >
              Start Scanning →
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-40 pb-32 px-6 text-center relative overflow-hidden">
        {/* Decorative glows */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-brand-600/15 blur-3xl pointer-events-none" />
        <div className="absolute top-32 right-[15%] w-[280px] h-[280px] rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 text-sm text-slate-300 mb-8 animate-fade-in border border-orange-500/20">
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            Powered by Gemini Vision + n8n Automation
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6 animate-slide-up">
            Extract Invoice Data{' '}
            <span className="gradient-text">Instantly</span>
            <br />with AI OCR
          </h1>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up">
            Drop any invoice or receipt. Our AI pipeline powered by GPT-4o and n8n
            extracts every field — vendor, amount, line items — in under 15 seconds.
            Stored securely in Supabase.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <button
              onClick={() => navigate('/app/upload')}
              className="btn-primary flex items-center gap-2 text-base"
            >
              <Upload size={18} />
              Upload Your First Invoice
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/app')}
              className="btn-secondary flex items-center gap-2 text-base"
            >
              <BarChart3 size={18} />
              View Dashboard
            </button>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-slate-500">
            {['No credit card', 'Self-hosted n8n', 'Open source on GitHub', 'Supabase backend'].map(t => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-green-400" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section id="stats" className="py-16 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-4xl font-extrabold gradient-text mb-2">{value}</p>
              <p className="text-slate-400 text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-bold text-white mb-4">Everything you need for document AI</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              A complete pipeline from upload to structured data, built on tools you already trust.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="card hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 group"
              >
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon size={20} className={color} />
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-bold text-white mb-4">From file to data in 4 steps</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map(({ num, title, desc }, i) => (
              <div key={num} className="relative text-center">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-3/4 w-1/2 h-px bg-gradient-to-r from-brand-600/40 to-transparent" />
                )}
                <div className="w-12 h-12 rounded-2xl bg-brand-600/20 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-brand-300 font-bold text-sm">{num}</span>
                </div>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="card border-brand-500/20 bg-brand-600/5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-purple-600/5 pointer-events-none" />
            <div className="relative">
              <h2 className="text-4xl font-bold text-white mb-4">Ready to automate your invoices?</h2>
              <p className="text-slate-300 text-lg mb-8">
                Connect your n8n, point to your Supabase, and start scanning in minutes.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => navigate('/app/upload')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Zap size={18} />
                  Launch OCR Platform
                </button>
                <a
                  href="https://github.com/wallapsu-data/CustomAI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2"
                >
                  <Github size={18} />
                  View Source
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-brand-600/80 flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <span className="text-slate-400 font-medium">DocScan AI</span>
        </div>
        <p>Built with React + Tailwind · n8n Automation · Supabase · Deployed on Vercel</p>
        <p className="mt-1">
          <a href="https://github.com/wallapsu-data/CustomAI" className="hover:text-slate-300 underline underline-offset-2">
            github.com/wallapsu-data/CustomAI
          </a>
        </p>
      </footer>
    </div>
  )
}
