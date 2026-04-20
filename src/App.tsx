import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSession } from './lib/session'
import Gallery from './pages/Gallery'
import ViewBuilder from './pages/ViewBuilder'
import Dashboard from './pages/Dashboard'
import SavedViews from './pages/SavedViews'
import NamePrompt from './components/common/NamePrompt'

export default function App() {
  const { user, setUser } = useSession()

  if (!user) {
    return <NamePrompt onConfirm={setUser} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/view/:id" element={<ViewBuilder />} />
        <Route path="/view/new" element={<ViewBuilder />} />
        <Route path="/dashboard/:id" element={<Dashboard />} />
        <Route path="/saved" element={<SavedViews />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
