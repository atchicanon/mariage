import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import WeddingOverview from './pages/WeddingOverview'
import Guests from './pages/Guests'
import Budget from './pages/Budget'
import Tasks from './pages/Tasks'
import Vendors from './pages/Vendors'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mariage/:weddingId" element={<WeddingOverview />} />
          <Route path="/mariage/:weddingId/invites" element={<Guests />} />
          <Route path="/mariage/:weddingId/budget" element={<Budget />} />
          <Route path="/mariage/:weddingId/taches" element={<Tasks />} />
          <Route path="/mariage/:weddingId/prestataires" element={<Vendors />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
