import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { getCurrentUser, setCurrentUser, updateUserProfile, updateUserPassword, loginUser } from '../lib/auth.js'

function Field({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  )
}

function Alert({ type, msg }) {
  if (!msg) return null
  const isOk = type === 'success'
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm border ${
      isOk ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
    }`}>
      {isOk ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const user = getCurrentUser()

  // Profile fields
  const [name, setName]       = useState(user?.name ?? '')
  const [surname, setSurname] = useState(user?.surname ?? '')
  const [email, setEmail]     = useState(user?.email ?? '')
  const [dept, setDept]       = useState(user?.business_unit ?? '')
  const [profileMsg, setProfileMsg] = useState(null)
  const [profileErr, setProfileErr] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Password fields
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [pwMsg, setPwMsg]           = useState(null)
  const [pwErr, setPwErr]           = useState(null)
  const [pwLoading, setPwLoading]   = useState(false)

  async function saveProfile() {
    setProfileMsg(null); setProfileErr(null)
    setProfileLoading(true)
    try {
      await updateUserProfile(user.email, {
        name,
        surname,
        businessUnit: dept,
        newEmail: email !== user.email ? email : undefined,
      })
      // Update localStorage
      const updated = { ...user, name, surname, business_unit: dept, email }
      setCurrentUser(updated)
      setProfileMsg('Profile updated successfully.')
    } catch (e) {
      setProfileErr(e.message)
    } finally {
      setProfileLoading(false)
    }
  }

  async function changePassword() {
    setPwMsg(null); setPwErr(null)
    if (!currentPw) { setPwErr('Enter your current password.'); return }
    if (newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return }
    setPwLoading(true)
    try {
      // Verify current password by attempting login
      await loginUser(user.email, currentPw)
      await updateUserPassword(user.email, newPw)
      setPwMsg('Password changed successfully.')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e) {
      setPwErr('Current password is incorrect or update failed.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm">Manage your personal information and security</p>
      </div>

      {/* Profile card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User size={16} className="text-blue-400" />
          <h2 className="font-semibold text-white">Personal Information</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="First Name"  value={name}    onChange={setName}    placeholder="First name" />
          <Field label="Last Name"   value={surname} onChange={setSurname} placeholder="Last name" />
        </div>
        <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="email@example.com" />
        <Field label="Department / Business Unit" value={dept} onChange={setDept} placeholder="e.g. Logistics Operations" />

        <Alert type="success" msg={profileMsg} />
        <Alert type="error"   msg={profileErr} />

        <button
          onClick={saveProfile}
          disabled={profileLoading}
          className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm disabled:opacity-50"
        >
          {profileLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</> : <><Save size={14} /> Save Changes</>}
        </button>
      </div>

      {/* Password card */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} className="text-amber-400" />
          <h2 className="font-semibold text-white">Change Password</h2>
        </div>

        <Field label="Current Password"  type="password" value={currentPw} onChange={setCurrentPw} placeholder="••••••••" />
        <Field label="New Password"      type="password" value={newPw}     onChange={setNewPw}     placeholder="Min 8 characters" />
        <Field label="Confirm New Password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" />

        <Alert type="success" msg={pwMsg} />
        <Alert type="error"   msg={pwErr} />

        <button
          onClick={changePassword}
          disabled={pwLoading}
          className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm disabled:opacity-50"
        >
          {pwLoading ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Updating…</> : <><Lock size={14} /> Change Password</>}
        </button>
      </div>

      {/* Account info (read-only) */}
      <div className="card">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Account Info</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Role</span>
            <span className={`font-medium ${user?.is_admin ? 'text-red-400' : 'text-slate-300'}`}>
              {user?.is_admin ? '👑 Admin' : 'User'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Signed in as</span>
            <span className="text-slate-300">{user?.email}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
