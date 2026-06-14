import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext.jsx'
import LandingPage from './pages/LandingPage.jsx'
import AppLayout from './components/layout/AppLayout.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="results/:documentId" element={<ResultsPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  )
}
