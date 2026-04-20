import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../../lib/session'
import { useInsights } from '../../lib/useInsights'
import SoWhatButton from '../insights/SoWhatButton'
import SoWhatPanel from '../insights/SoWhatPanel'
import clsx from 'clsx'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function AppShell({ children, className }: Props) {
  const { user, switchUser } = useSession()
  const navigate = useNavigate()
  const [panelOpen, setPanelOpen] = useState(false)

  const { insights, loading: insightsLoading, totalActive, submitFeedback } = useInsights()

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="bg-primary-800 text-white border-b border-primary-900 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center">
              <img
                src="/catertrax-logo.png"
                alt="CaterTrax"
                className="h-7 w-auto brightness-0 invert"
              />
            </Link>

            <nav className="hidden sm:flex items-center gap-1">
              <NavLink to="/">Gallery</NavLink>
              <NavLink to="/saved">My Views</NavLink>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-white/60 hidden sm:block">
                {user.display_name}
              </span>
            )}
            <button
              onClick={() => {
                switchUser()
                navigate('/')
              }}
              className="text-xs text-white/50 hover:text-white border border-white/20 hover:border-white/50 px-2.5 py-1 rounded transition-colors"
            >
              Switch user
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={clsx('flex-1', className)}>{children}</main>

      {/* Floating insights button */}
      <SoWhatButton count={totalActive} onClick={() => setPanelOpen(true)} />

      {/* Insights panel */}
      {panelOpen && (
        <SoWhatPanel
          insights={insights}
          loading={insightsLoading}
          onAction={(id, action) => submitFeedback(id, action)}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="px-3 py-1.5 rounded text-sm font-medium text-white/75 hover:text-white hover:bg-white/10 transition-colors"
    >
      {children}
    </Link>
  )
}
