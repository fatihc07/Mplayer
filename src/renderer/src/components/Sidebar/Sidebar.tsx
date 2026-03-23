import { useLibraryStore } from '../../stores/libraryStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useI18n } from '../../i18n'
import { ViewType } from '../../types'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  TrendingUp, Library, History,
  Heart, FolderPlus, FolderOpen, Headphones, RotateCcw, Settings, ListMusic, BarChart3, GitBranch,
  Sparkles, Copy, GripVertical, Eye, EyeOff, Repeat, Globe
} from 'lucide-react'

interface NavItem {
  id: ViewType
  labelKey: string
  Icon: React.FC<any>
}

const ALL_ITEMS: NavItem[] = [
  { id: 'trends',     labelKey: 'trends',     Icon: TrendingUp },
  { id: 'library',    labelKey: 'library',    Icon: Library },
  { id: 'history',    labelKey: 'history',    Icon: History },
  { id: 'like',       labelKey: 'favorites',  Icon: Heart },
  { id: 'playlists',  labelKey: 'playlists',  Icon: ListMusic },
  { id: 'wrapped',    labelKey: 'wrapped',    Icon: Sparkles },
  { id: 'replay',     labelKey: 'replay',     Icon: Repeat },
  { id: 'deezer',     labelKey: 'deezer',     Icon: Globe },
  { id: 'duplicates', labelKey: 'duplicates', Icon: Copy },
  { id: 'stats',      labelKey: 'stats',      Icon: BarChart3 },
  { id: 'folders',    labelKey: 'folders',    Icon: FolderOpen },
  { id: 'versions',   labelKey: 'versions',   Icon: GitBranch },
  { id: 'settings',   labelKey: 'settings',   Icon: Settings },
]

const DEFAULT_ORDER = ALL_ITEMS.map((i) => i.id)
const DEFAULT_HIDDEN: ViewType[] = []

export function Sidebar(): JSX.Element {
  const { currentView, setCurrentView, addAndScanFolder, stats, loadInitial } = useLibraryStore()
  const { resetCurrentSongPlayCount } = usePlayerStore()
  const { t } = useI18n()
  const [version, setVersion] = useState('')
  const [customizing, setCustomizing] = useState(false)
  const [order, setOrder] = useState<ViewType[]>(DEFAULT_ORDER)
  const [hidden, setHidden] = useState<ViewType[]>(DEFAULT_HIDDEN)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  useEffect(() => {
    window.api.getVersion().then(setVersion)
    // Load saved sidebar config
    window.api.getSetting('sidebar_order').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) setOrder(parsed)
        } catch { /* ignore */ }
      }
    })
    window.api.getSetting('sidebar_hidden').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val)
          if (Array.isArray(parsed)) setHidden(parsed)
        } catch { /* ignore */ }
      }
    })
  }, [])

  const saveConfig = useCallback((newOrder: ViewType[], newHidden: ViewType[]) => {
    window.api.setSetting('sidebar_order', JSON.stringify(newOrder))
    window.api.setSetting('sidebar_hidden', JSON.stringify(newHidden))
  }, [])

  const handleDragStart = (idx: number) => { dragItem.current = idx }
  const handleDragEnter = (idx: number) => { dragOver.current = idx }
  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return
    const newOrder = [...order]
    const [moved] = newOrder.splice(dragItem.current, 1)
    newOrder.splice(dragOver.current, 0, moved)
    setOrder(newOrder)
    saveConfig(newOrder, hidden)
    dragItem.current = null
    dragOver.current = null
  }

  const toggleHidden = (id: ViewType) => {
    const newHidden = hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]
    setHidden(newHidden)
    saveConfig(order, newHidden)
  }

  const handleResetPlays = async () => {
    const confirmed = window.confirm(t.resetConfirm)
    if (!confirmed) return
    await window.api.resetAllPlays()
    resetCurrentSongPlayCount()
    await loadInitial()
  }

  const itemMap = new Map(ALL_ITEMS.map((i) => [i.id, i]))
  const visibleItems = order.filter((id) => !hidden.includes(id) && itemMap.has(id))

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Headphones size={20} />
        </div>
        <div className="sidebar-logo-text-col">
          <span className="sidebar-logo-text">MusicApp</span>
          {version && <span className="sidebar-version">v{version}</span>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {customizing ? (
          <div className="sidebar-customize">
            <h3 className="sidebar-group-title">{t.sidebarCustomize}</h3>
            {order.map((id, idx) => {
              const item = itemMap.get(id)
              if (!item) return null
              const isHidden = hidden.includes(id)
              return (
                <div
                  key={id}
                  className={`sidebar-cust-item ${isHidden ? 'sidebar-cust-hidden' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <GripVertical size={14} className="sidebar-cust-grip" />
                  <item.Icon size={15} />
                  <span>{(t as any)[item.labelKey] || item.labelKey}</span>
                  <button
                    className="sidebar-cust-vis"
                    onClick={() => toggleHidden(id)}
                  >
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              )
            })}
            <button className="sidebar-cust-done" onClick={() => setCustomizing(false)}>
              {t.close}
            </button>
          </div>
        ) : (
          <div className="sidebar-group">
            {visibleItems.map((id) => {
              const item = itemMap.get(id)!
              return (
                <button
                  key={id}
                  className={`sidebar-item ${currentView === id ? 'active' : ''}`}
                  onClick={() => setCurrentView(id)}
                >
                  <item.Icon size={17} />
                  <span>{(t as any)[item.labelKey] || item.labelKey}</span>
                </button>
              )
            })}
          </div>
        )}
      </nav>

      {/* Stats pill */}
      {stats && stats.total_songs > 0 && (
        <div className="sidebar-stats">
          <span>{stats.total_songs.toLocaleString()} {t.songs}</span>
          <span>{stats.total_artists} {t.artists}</span>
        </div>
      )}

      <button className="sidebar-add-btn" onClick={addAndScanFolder}>
        <FolderPlus size={15} />
        <span>{t.addFolder}</span>
      </button>
      <button className="sidebar-reset-btn" onClick={handleResetPlays}>
        <RotateCcw size={14} />
        <span>{t.resetPlays}</span>
      </button>
      {!customizing && (
        <button className="sidebar-reset-btn" onClick={() => setCustomizing(true)}>
          <Settings size={14} />
          <span>{t.sidebarCustomize}</span>
        </button>
      )}
    </aside>
  )
}
