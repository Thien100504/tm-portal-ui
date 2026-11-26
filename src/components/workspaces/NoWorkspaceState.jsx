import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import CreateWorkspaceModal from './CreateWorkspaceModal';

export default function NoWorkspaceState({ compact = false }) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  return (
    <div
      className={`text-center rounded-2xl border border-dashed border-border bg-card/40 px-6 ${
        compact ? 'py-8' : 'py-20'
      }`}
    >
      <div className="w-16 h-16 bg-[color:var(--color-ai)]/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Building2 className="w-8 h-8 text-[color:var(--color-ai)]" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">{t('workspace.empty_title')}</h2>
      <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
        {t('workspace.empty_desc')}
      </p>
      <Button
        onClick={() => setCreating(true)}
        className="px-5 py-2 rounded-xl inline-flex items-center gap-2"
      >
        <Plus className="w-4 h-4" /> {t('sidebar.create_workspace')}
      </Button>
      {creating && <CreateWorkspaceModal onClose={() => setCreating(false)} />}
    </div>
  );
}
