import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight, Inbox, Goal } from 'lucide-react';
import sprintService from '@/services/sprintService';
import { getApiError } from '@/lib/apiError';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import CustomSelect from '@/components/ui/CustomSelect';

/**
 * Modal to complete a sprint.
 * Shows the stats (done/incomplete) and lets the PM decide what happens to unfinished tasks.
 *
 * Props:
 *   sprint      — the active sprint to complete
 *   allSprints  — every sprint of the project (to pick the one receiving tasks)
 *   projectId   — used to invalidate queries
 *   onClose     — closes the modal
 */
export default function EndSprintModal({ sprint, allSprints, projectId, onClose }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [incompleteAction, setIncompleteAction] = useState('backlog');
  const [targetSprintId, setTargetSprintId] = useState('');

  // Load the stats before completing
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['sprint-stats', sprint.id],
    queryFn: () => sprintService.getSprintStats(sprint.id),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      sprintService.completeSprint(
        sprint.id,
        incompleteAction,
        incompleteAction === 'next_sprint' ? targetSprintId : null,
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(t('endSprint.success', { name: sprint.name }), {
        description: t('endSprint.success_desc', {
          done: data.done_count,
          total: data.total_count,
          incomplete: data.incomplete_count,
          action: incompleteAction === 'backlog' ? t('endSprint.to_backlog') : t('endSprint.to_next')
        }),
      });
      onClose();
    },
    onError: (err) => {
      toast.error(t('common.error'), { description: getApiError(err, t('common.error')) });
    },
  });

  // Sprints that can receive tasks (planning or active, not the current one)
  const targetSprints = allSprints.filter(
    (s) => s.id !== sprint.id && s.status !== 'completed',
  );

  const canConfirm =
    incompleteAction === 'backlog' ||
    (incompleteAction === 'next_sprint' && targetSprintId);

  return (
    <Modal
      title={t('endSprint.title')}
      icon={<Goal className="w-4 h-4 text-[color:var(--color-ai)]" />}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            {t('endSprint.buttons.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || completeMutation.isPending || isLoadingStats}
            onClick={() => completeMutation.mutate()}
            className="flex-1"
          >
            {completeMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> {t('endSprint.buttons.processing')}</>
            ) : (
              t('endSprint.buttons.confirm')
            )}
          </Button>
        </div>
      }
    >
          <div className="p-5 space-y-5">
            {/* Sprint name */}
            <div className="bg-muted/40 rounded-lg px-4 py-3 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-1">{t('endSprint.sprint_label')}</p>
              <p className="text-sm font-semibold">{sprint.name}</p>
            </div>

            {/* Stats */}
            {isLoadingStats ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-[color:var(--color-ai)]" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <StatBox
                  label={t('endSprint.stats.total')}
                  value={stats.total_tasks}
                  color="text-foreground"
                />
                <StatBox
                  label={t('endSprint.stats.done')}
                  value={stats.done_tasks}
                  color="text-[color:var(--color-success)]"
                  icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                />
                <StatBox
                  label={t('endSprint.stats.incomplete')}
                  value={stats.incomplete_tasks}
                  color={stats.incomplete_tasks > 0 ? 'text-[color:var(--color-warning)]' : 'text-muted-foreground'}
                  icon={stats.incomplete_tasks > 0 ? <AlertCircle className="w-3.5 h-3.5" /> : null}
                />
              </div>
            ) : null}

            {/* Incomplete task action — only shown when some tasks are not done */}
            {stats && stats.incomplete_tasks > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-foreground">
                  {t('endSprint.action_prompt', { count: stats.incomplete_tasks })}
                </p>

                {/* Option: Backlog */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${incompleteAction === 'backlog' ? 'border-[color:var(--color-ai)] bg-[color:var(--color-ai)]/5' : 'border-border hover:border-muted-foreground/30'}`}>
                  <input
                    type="radio"
                    name="incomplete_action"
                    value="backlog"
                    checked={incompleteAction === 'backlog'}
                    onChange={() => setIncompleteAction('backlog')}
                    className="mt-0.5 accent-[color:var(--color-ai)]"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Inbox className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{t('endSprint.actions.backlog.title')}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{t('endSprint.actions.backlog.desc')}</p>
                  </div>
                </label>

                {/* Option: Next sprint */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${incompleteAction === 'next_sprint' ? 'border-[color:var(--color-ai)] bg-[color:var(--color-ai)]/5' : 'border-border hover:border-muted-foreground/30'}`}>
                  <input
                    type="radio"
                    name="incomplete_action"
                    value="next_sprint"
                    checked={incompleteAction === 'next_sprint'}
                    onChange={() => setIncompleteAction('next_sprint')}
                    className="mt-0.5 accent-[color:var(--color-ai)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{t('endSprint.actions.next_sprint.title')}</span>
                    </div>
                    {incompleteAction === 'next_sprint' && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <CustomSelect
                          options={targetSprints.map((s) => ({
                            value: s.id,
                            label: `${s.name} (${s.status === 'active' ? t('endSprint.status.active') : t('endSprint.status.planning')})`,
                          }))}
                          value={targetSprintId}
                          onChange={setTargetSprintId}
                          placeholder={t('endSprint.actions.next_sprint.select')}
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* Completion rate summary */}
            {stats && stats.total_tasks > 0 && (
              <div>
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>{t('endSprint.completion_rate')}</span>
                  <span className="font-mono font-semibold">{stats.completion_rate}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[color:var(--color-success)] rounded-full transition-all duration-500"
                    style={{ width: `${stats.completion_rate}%` }}
                  />
                </div>
                {stats.actual_days && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {t('endSprint.actual_days')}: <span className="font-mono">{stats.actual_days}</span> {t('endSprint.days_unit')}
                  </p>
                )}
              </div>
            )}
          </div>
    </Modal>
  );
}

function StatBox({ label, value, color, icon }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 border border-border text-center">
      <div className={`text-xl font-bold font-mono ${color} flex items-center justify-center gap-1`}>
        {icon}
        {value}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
