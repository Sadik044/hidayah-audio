import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Lazy load public pages for optimal initial bundle transfer
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Browse = lazy(() => import('./pages/Browse').then((m) => ({ default: m.Browse })));
const SeriesDetails = lazy(() => import('./pages/SeriesDetails').then((m) => ({ default: m.SeriesDetails })));
const EpisodeDetails = lazy(() => import('./pages/EpisodeDetails').then((m) => ({ default: m.EpisodeDetails })));
const Search = lazy(() => import('./pages/Search').then((m) => ({ default: m.Search })));
const Favorites = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.Favorites })));
const RecentlyPlayed = lazy(() => import('./pages/RecentlyPlayed').then((m) => ({ default: m.RecentlyPlayed })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

// Lazy load admin pages to keep the public bundle ultra lightweight
const AdminLogin = lazy(() =>
  import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin }))
);
const AdminMfaSetup = lazy(() =>
  import('./pages/admin/AdminMfaSetup').then((m) => ({ default: m.AdminMfaSetup }))
);
const AdminMfaChallenge = lazy(() =>
  import('./pages/admin/AdminMfaChallenge').then((m) => ({ default: m.AdminMfaChallenge }))
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
                  path="/admin/mfa-setup"
                  element={
                    <ProtectedRoute requireAal2={false}>
                      <Suspense fallback={<PageLoader />}>
                        <AdminMfaSetup />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/mfa"
                  element={
                    <ProtectedRoute requireAal2={false}>
                      <Suspense fallback={<PageLoader />}>
                        <AdminMfaChallenge />
                      </Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requireAal2={true}>
                      <Suspense fallback={<PageLoader />}>
                        <AdminDashboard />
                      </Suspense>
                    </ProtectedRoute>
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
