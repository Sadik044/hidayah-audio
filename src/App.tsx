import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { AppShell } from './components/layout/AppShell';

import { Home } from './pages/Home';
import { Browse } from './pages/Browse';
import { SeriesDetails } from './pages/SeriesDetails';
import { EpisodeDetails } from './pages/EpisodeDetails';
import { Search } from './pages/Search';
import { Favorites } from './pages/Favorites';
import { RecentlyPlayed } from './pages/RecentlyPlayed';
import { NotFound } from './pages/NotFound';

// Lazy load admin pages to keep the public bundle ultra lightweight
const AdminLogin = lazy(() =>
  import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin }))
);
const AdminDashboard = lazy(() =>
  import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

const PageLoader: React.FC = () => (
  <div className="py-24 text-center text-xs text-stone-500 animate-pulse">
    লোড হচ্ছে...
  </div>
);

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AudioPlayerProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/categories" element={<Navigate to="/browse" replace />} />
                <Route path="/series/:id" element={<SeriesDetails />} />
                <Route path="/episodes/:id" element={<EpisodeDetails />} />
                <Route path="/episode/:id" element={<EpisodeDetails />} />
                <Route path="/search" element={<Search />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/recent" element={<RecentlyPlayed />} />

                {/* Admin Routes */}
                <Route
                  path="/admin/login"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminLogin />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <AdminDashboard />
                    </Suspense>
                  }
                />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AudioPlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
