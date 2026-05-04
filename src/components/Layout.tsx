import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom'
import {
  Heart,
  Users,
  DollarSign,
  CheckSquare,
  Briefcase,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react'
import { useWeddingStore } from '../store/weddingStore'

export default function Layout() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const { weddings, setActiveWedding } = useWeddingStore()
  const navigate = useNavigate()

  const activeWedding = weddings.find((w) => w.id === weddingId)

  const navItems = weddingId
    ? [
        { to: `/mariage/${weddingId}`, icon: LayoutDashboard, label: 'Vue d\'ensemble', end: true },
        { to: `/mariage/${weddingId}/invites`, icon: Users, label: 'Invités' },
        { to: `/mariage/${weddingId}/budget`, icon: DollarSign, label: 'Budget' },
        { to: `/mariage/${weddingId}/taches`, icon: CheckSquare, label: 'Tâches' },
        { to: `/mariage/${weddingId}/prestataires`, icon: Briefcase, label: 'Prestataires' },
      ]
    : []

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <NavLink to="/" className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span className="font-serif text-xl text-gray-800">Notre Mariage</span>
          </NavLink>
        </div>

        {/* Wedding switcher */}
        {weddings.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Mariage</p>
            <div className="space-y-1">
              {weddings.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setActiveWedding(w.id)
                    navigate(`/mariage/${w.id}`)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    w.id === weddingId
                      ? 'bg-rose-50 text-rose-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{w.type === 'civil' ? '🏛️' : '⛪'}</span>
                    <span className="truncate">{w.name}</span>
                  </div>
                  {w.id === weddingId && <ChevronDown className="w-3 h-3 opacity-50" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        {navItems.length > 0 && (
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-rose-50 text-rose-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <NavLink
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Tous les mariages
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {activeWedding && (
          <header className="bg-white border-b border-gray-200 px-8 py-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{activeWedding.type === 'civil' ? '🏛️' : '⛪'}</span>
              <div>
                <h1 className="font-serif text-xl text-gray-800">{activeWedding.name}</h1>
                <p className="text-sm text-gray-500">{activeWedding.location}</p>
              </div>
            </div>
          </header>
        )}
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
