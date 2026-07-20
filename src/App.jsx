import { Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MatchingPage from './pages/MatchingPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { getCurrentUser } from './lib/auth.js'

function ProtectedRoute({ children }) {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="upload"   element={<UploadPage />} />
        <Route path="matching" element={<MatchingPage />} />
        <Route path="results/:documentId" element={<ResultsPage />} />
        <Route path="history"  element={<HistoryPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
