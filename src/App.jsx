import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Pages
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ProjectListPage from '@/pages/ProjectListPage';
import ProjectOverviewPage from '@/pages/ProjectOverviewPage';
import KanbanPage from '@/pages/KanbanPage';
import SprintBoardPage from '@/pages/SprintBoardPage';
import AutomationPage from '@/pages/AutomationPage';
import NotificationsPage from '@/pages/NotificationsPage';
import TimelinePage from '@/pages/TimelinePage';
import WorkspaceSettingsPage from '@/pages/WorkspaceSettingsPage';
import RoadmapPage from '@/pages/RoadmapPage';
import ProjectSettingsPage from '@/pages/ProjectSettingsPage';
import ProfilePage from '@/pages/ProfilePage';

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes with Sidebar Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectListPage />} />
            <Route path="/projects/:id" element={<ProjectOverviewPage />} />
            <Route path="/projects/:id/kanban" element={<KanbanPage />} />
            <Route path="/projects/:id/sprints" element={<SprintBoardPage />} />
            <Route path="/projects/:id/timeline" element={<TimelinePage />} />
            <Route path="/projects/:id/roadmap" element={<RoadmapPage />} />
            <Route path="/projects/:id/automation" element={<AutomationPage />} />
            <Route path="/projects/:id/settings" element={<ProjectSettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/workspace-settings" element={<WorkspaceSettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
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

