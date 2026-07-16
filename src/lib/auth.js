import { supabase } from './supabase.js'

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export async function loginUser(email, password) {
  const hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('app_users')
    .select('id, name, surname, email, business_unit')
    .eq('email', email.toLowerCase().trim())
    .eq('password_hash', hash)
    .single()
  if (error || !data) throw new Error('Invalid email or password')
  return data
}

export async function registerUser({ name, surname, email, businessUnit, password }) {
  const { data: existing } = await supabase
    .from('app_users')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()
  if (existing) throw new Error('Email already registered')
  const hash = await hashPassword(password)
  const { data, error } = await supabase
    .from('app_users')
    .insert({ name: name.trim(), surname: surname.trim(), email: email.toLowerCase().trim(), business_unit: businessUnit.trim(), password_hash: hash })
    .select('id, name, email')
    .single()
  if (error) throw new Error(error.message || 'Registration failed')
  return data
}

export async function resetUserPassword(email) {
  const tempPw = generateTempPassword()
  const hash = await hashPassword(tempPw)
  const { error, count } = await supabase
    .from('app_users')
    .update({ password_hash: hash })
    .eq('email', email.toLowerCase().trim())
    .select()
  if (error) throw new Error('Email not found in our system')
  return tempPw
}

export async function updateUserPassword(email, newPassword) {
  const hash = await hashPassword(newPassword)
  const { error } = await supabase
    .from('app_users')
    .update({ password_hash: hash })
    .eq('email', email.toLowerCase().trim())
  if (error) throw new Error('Failed to update password')
}

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('app_user') || 'null') } catch { return null }
}

export function setCurrentUser(user) {
  if (user) localStorage.setItem('app_user', JSON.stringify(user))
  else localStorage.removeItem('app_user')
}

export function logoutUser() {
  localStorage.removeItem('app_user')
}
