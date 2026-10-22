import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';

// Temporary landing page until the dashboard feature is implemented.
export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-2 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{t('sidebar.dashboard')}</h1>
      <p className="text-sm text-muted-foreground">{user?.full_name || user?.email}</p>
    </div>
  );
}
