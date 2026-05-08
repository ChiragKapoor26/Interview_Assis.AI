import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import SetupPage from './pages/SetupPage'
import InterviewRoom from './pages/InterviewRoom'
import Dashboard from './pages/Dashboard'
import './index.css'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#050508' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage user={user} />} />
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        <Route path="/setup" element={user ? <SetupPage user={user} /> : <Navigate to="/auth" />} />
        <Route path="/interview/:id" element={user ? <InterviewRoom user={user} /> : <Navigate to="/auth" />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/auth" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
