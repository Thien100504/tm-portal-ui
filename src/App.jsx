import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Pages

import { Toaster } from 'sonner';

export default function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language || 'en';
  }, [i18n.language]);

  return (
    <BrowserRouter>
      <Toaster 
        richColors 
        position="top-right" 
        toastOptions={{
          className: 'bg-background/80 backdrop-blur-md border border-border shadow-xl rounded-xl text-foreground font-sans',
          style: {
            fontFamily: 'var(--font-sans)'
          }
        }}
      />
      <Routes>
        {/* Public routes */}

        {/* Protected routes with Sidebar Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

