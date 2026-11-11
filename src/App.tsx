import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import BoardListPage from './pages/BoardListPage'
import BoardPage from './pages/BoardPage'
import ProfilePage from './pages/ProfilePage'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardListPage />} />
      <Route path="/board/:slug"          element={<Layout><BoardPage /></Layout>} />
      <Route path="/board/:slug/profile"  element={<Layout><ProfilePage /></Layout>} />
      <Route path="/board/:slug/settings" element={<Layout><SettingsPage /></Layout>} />
      <Route path="/board/:slug/review"   element={<Layout><ReviewPage /></Layout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
