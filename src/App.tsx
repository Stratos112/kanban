import { Routes, Route, Navigate } from 'react-router-dom'
import BoardPage from './pages/BoardPage'
import ProfilePage from './pages/ProfilePage'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
