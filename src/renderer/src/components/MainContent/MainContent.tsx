import { useLibraryStore } from '../../stores/libraryStore'
import { TrendsView } from './TrendsView'
import { ArtistsView } from './ArtistsView'
import { LibraryView } from './LibraryView'
import { HistoryView } from './HistoryView'
import { FavoritesView } from './FavoritesView'
import { PlaylistsView } from './PlaylistsView'
import { SettingsView } from './SettingsView'
import { FoldersView } from './FoldersView'
import { StatsView } from './StatsView'
import { VersionsView } from './VersionsView'
import { WrappedView } from './WrappedView'
import { ReplayView } from './ReplayView'
import { DuplicatesView } from './DuplicatesView'

export function MainContent(): JSX.Element {
  const { currentView } = useLibraryStore()

  return (
    <main className="main-content">
      {currentView === 'trends'     && <TrendsView />}
      {currentView === 'artists'    && <ArtistsView />}
      {currentView === 'library'    && <LibraryView />}
      {currentView === 'history'    && <HistoryView />}
      {currentView === 'like'       && <FavoritesView />}
      {currentView === 'playlists'  && <PlaylistsView />}
      {currentView === 'settings'   && <SettingsView />}
      {currentView === 'folders'    && <FoldersView />}
      {currentView === 'stats'      && <StatsView />}
      {currentView === 'versions'   && <VersionsView />}
      {currentView === 'wrapped'    && <WrappedView />}
      {currentView === 'replay'     && <ReplayView />}
      {currentView === 'duplicates' && <DuplicatesView />}
    </main>
  )
}
