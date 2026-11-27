import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { getApiError } from '@/lib/apiError';
import chatService from '@/services/chatService';

const MAX_SHOWN = 10;

/**
 * A delete the assistant asked for. Nothing happens until the user presses
 * Delete here: the server then checks the one-time token and the user's rights.
 */
export default function ConfirmCard({ action, sessionId }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [state, setState] = useState('pending'); // pending | busy | done | cancelled | expired
  const [error, setError] = useState('');
  const lang = i18n.language?.startsWith('vi') ? 'vi' : 'en';
  const isRule = action.kind === 'delete_rule';

  const decide = async (confirm) => {
    setState('busy');
    setError('');
    try {
      const res = await chatService.resolveAction(sessionId, action.token, { confirm, lang });
      if (res.status !== 'done') {
        setState('cancelled');
        return;
      }
      toast.success(
        isRule
          ? t('chatbot.toast.rule_deleted', { name: res.name })
          : t('chatbot.toast.tasks_deleted', { count: res.count })
      );
      ['tasks', 'automation-rules', 'projects', 'epics'].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] })
      );
      setState('done');
    } catch (err) {
      if (err?.response?.status === 404) {
        setState('expired');
      } else {
        setError(getApiError(err, t('common.error')));
        setState('pending');
      }
    }
  };

  const title = isRule
    ? t('assistant.confirm.delete_rule', { name: action.titles?.[0] || '' })
    : t('assistant.confirm.delete_tasks', { count: action.titles?.length || 0 });

  return (
    <div
      role="group"
      aria-label={title}
      className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[12px]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          {!isRule && (
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              {action.titles.slice(0, MAX_SHOWN).map((name, n) => (
                <li key={n} className="truncate">
                  {name}
                </li>
              ))}
            </ul>
          )}
          {state === 'pending' || state === 'busy' ? (
            <>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('assistant.confirm.hint')}
              </p>
              {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decide(true)}
                  disabled={state === 'busy'}
                >
                  {state === 'busy' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t('assistant.confirm.delete')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => decide(false)}
                  disabled={state === 'busy'}
                >
                  {t('assistant.confirm.cancel')}
                </Button>
              </div>
            </>
          ) : (
            <p
              className={`mt-1.5 flex items-center gap-1 text-[11px] ${
                state === 'done' ? 'text-emerald-600' : 'text-muted-foreground'
              }`}
            >
              {state === 'done' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
              {t(`assistant.confirm.${state}`)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
