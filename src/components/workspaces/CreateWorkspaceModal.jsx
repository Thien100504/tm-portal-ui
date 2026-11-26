import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import workspaceService from '@/services/workspaceService';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Card } from '@/components/ui/Card';

export default function CreateWorkspaceModal({ onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const setActiveWsId = useWorkspaceStore((state) => state.setActiveWorkspaceId);
  const [name, setName] = useState('');
  const [type, setType] = useState('personal'); // personal | team

  const mutation = useMutation({
    mutationFn: (data) => workspaceService.createWorkspace(data),
    onSuccess: (newWs) => {
      toast.success(t('workspace.created_success'));
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      setActiveWsId(newWs.id);
      onClose();
      navigate('/dashboard');
    },
    onError: () => {
      toast.error(t('workspace.create_failed'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({ name, type });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <Card
          className="w-full max-w-sm p-5 glass shadow-2xl border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground">{t('workspace.create_title')}</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {t('workspace.name_label')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('workspace.name_placeholder')}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--color-ai)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {t('workspace.type_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType('personal')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    type === 'personal'
                      ? 'bg-[color:var(--color-ai)]/10 border-[color:var(--color-ai)] text-[color:var(--color-ai)]'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('workspace.type.personal')}
                </button>
                <button
                  type="button"
                  onClick={() => setType('team')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    type === 'team'
                      ? 'bg-[color:var(--color-primary)]/10 border-[color:var(--color-primary)] text-[color:var(--color-primary)]'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('workspace.type.team')}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1.5 leading-normal">
                {type === 'team'
                  ? t('workspace.type_desc.team')
                  : t('workspace.type_desc.personal')}
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                {t('workspace.btn_cancel')}
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || !name.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-ai)] text-white text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
              >
                {mutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('workspace.btn_create')}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
