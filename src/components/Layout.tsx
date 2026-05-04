import { useState, useEffect } from 'react'
import { NavLink, Outlet, useParams, useNavigate } from 'react-router-dom'
import {
  Heart,
  Users,
  DollarSign,
  CheckSquare,
  Briefcase,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { useWeddingStore } from '../store/weddingStore'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const { weddingId } = useParams<{ weddingId: string }>()
  const { weddings, setWeddings, setActiveWedding, setLoading } = useWeddingStore()
  const navigate = useNavigate()

  useEffect(() => {
    supabase
      .from('weddings')
      .select('*')
      .order('date')
      .then(({ data }) => {
        if (data) setWeddings(data)
        setLoading(false)
      })
  }, [])

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' }
    catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed))
  }, [collapsed])

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [weddingId])

  const activeWedding = weddings.find((w) => w.id === weddingId)

  const navItems = weddingId
    ? [
        { to: `/mariage/${weddingId}`, icon: LayoutDashboard, label: "Vue d'ensemble", end: true },
        { to: `/mariage/${weddingId}/invites`, icon: Users, label: 'Invités' },
        { to: `/mariage/${weddingId}/budget`, icon: DollarSign, label: 'Budget' },
        { to: `/mariage/${weddingId}/taches`, icon: CheckSquare, label: 'Tâches' },
        { to: `/mariage/${weddingId}/prestataires`, icon: Briefcase, label: 'Prestataires' },
      ]
    : []

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <>
      {/* Logo */}
      <div className={`border-b border-gray-100 flex items-center ${collapsed ? 'p-4 justify-center' : 'p-6 gap-2'}`}>
        {collapsed ? (
          <NavLink to="/" onClick={onNav}>
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
          </NavLink>
        ) : (
          <NavLink to="/" className="flex items-center gap-2" onClick={onNav}>
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span className="font-serif text-xl text-gray-800">Notre Mariage</span>
          </NavLink>
        )}
      </div>

      {/* Wedding switcher */}
      {weddings.length > 0 && (
        <div className={`border-b border-gray-100 ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Mariage</p>
          )}
          <div className="space-y-1">
            {weddings.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setActiveWedding(w.id)
                  navigate(`/mariage/${w.id}`)
                  onNav?.()
                }}
                title={w.name}
                className={`w-full flex items-center rounded-lg text-sm transition-colors ${
                  collapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'
                } ${
                  w.id === weddingId
                    ? 'bg-rose-50 text-rose-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg shrink-0">{w.type === 'civil' ? '🏛️' : '⛪'}</span>
                {!collapsed && <span className="truncate">{w.name}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nav */}
      {navItems.length > 0 && (
        <nav className={`flex-1 space-y-1 ${collapsed ? 'p-2' : 'p-4'}`}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNav}
              title={label}
              className={({ isActive }) =>
                `flex items-center rounded-lg text-sm transition-colors ${
                  collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2'
                } ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-100">
          <NavLink
            to="/"
            onClick={onNav}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Tous les mariages
          </NavLink>
        </div>
      )}
    </>
  )

  return (
    <div className="min-h-screen flex">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-200 shrink-0 relative ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 z-10"
          title={collapsed ? 'Ouvrir le menu' : 'Réduire le menu'}
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3 text-gray-500" />
            : <ChevronLeft className="w-3 h-3 text-gray-500" />}
        </button>
      </aside>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white border-r border-gray-200 z-50 flex flex-col transition-transform duration-200 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <NavLink to="/" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
            <span className="font-serif text-lg text-gray-800">Notre Mariage</span>
          </NavLink>
          <button onClick={() => setMobileOpen(false)} className="btn-ghost p-1">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex flex-col flex-1 overflow-y-auto">
          <SidebarContent onNav={() => setMobileOpen(false)} />
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 md:py-4 flex items-center gap-3">
          {/* Hamburger (mobile only) */}
          <button
            className="md:hidden btn-ghost p-1 shrink-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {activeWedding ? (
            <>
              <span className="text-xl md:text-2xl">{activeWedding.type === 'civil' ? '🏛️' : '⛪'}</span>
              <div className="min-w-0">
                <h1 className="font-serif text-base md:text-xl text-gray-800 truncate">{activeWedding.name}</h1>
                <p className="text-xs md:text-sm text-gray-500 truncate">{activeWedding.location}</p>
              </div>
            </>
          ) : (
            <h1 className="font-serif text-lg text-gray-800">Notre Mariage</h1>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </main>

        {/* ── Mobile bottom nav ── */}
        {navItems.length > 0 && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                    isActive ? 'text-rose-600' : 'text-gray-400'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-rose-600' : ''}`} />
                    <span className="leading-tight text-center" style={{ fontSize: '10px' }}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
