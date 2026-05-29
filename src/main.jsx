import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import APP_CONFIG from './config/appConfig';
import './index.css';

/**
 * Gate: in auth mode (http/DB backend) show a loader while the session is
 * checked, then either the Login screen or the app. In local mode (default)
 * the app renders immediately — zero-config experience is preserved.
 */
function Gate() {
  const { loading, isAuthed } = useAuth();
  if (APP_CONFIG.requireAuth) {
    if (loading) {
      return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      );
    }
    if (!isAuthed) return <Login />;
  }
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
