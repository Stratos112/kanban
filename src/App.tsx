import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import BoardPage from './pages/BoardPage'
import ProfilePage from './pages/ProfilePage'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
