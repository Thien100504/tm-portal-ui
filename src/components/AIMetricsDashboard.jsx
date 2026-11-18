import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Brain, Zap, Clock, CheckCircle2,
  TrendingUp, Cpu, BarChart3, Activity,
  ThumbsUp, ThumbsDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import aiService from '@/services/aiService';
import { toast } from 'sonner';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { getApiError } from '@/lib/apiError';
import { Card } from '@/components/ui/Card';

const FEATURE_META = {
  breakdown: { label: 'AI Breakdown', icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  estimate:  { label: 'AI Estimate',  icon: Zap,   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  insights:  { label: 'AI Insights',  icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
};

const STATUS_STYLE = {
  generated: { label: 'Pending',  cls: 'bg-muted text-muted-foreground' },
  applied:   { label: 'Applied',  cls: 'bg-emerald-500/10 text-emerald-500' },
  rejected:  { label: 'Rejected', cls: 'bg-red-500/10 text-red-500' },
  modified:  { label: 'Modified', cls: 'bg-amber-500/10 text-amber-500' },
};

function StatCard({ icon: Icon, label, value, sub, color = 'text-foreground' }) {
  return (
    <Card className="glass-surface border border-border/60 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function AcceptanceBar({ rate }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Acceptance Rate</span>
        <span className="font-semibold text-foreground">{rate}%</span>
      </div>
      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}

function FeatureRow({ stat }) {
  const meta = FEATURE_META[stat.feature] || FEATURE_META.insights;
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{meta.label}</div>
        <div className="text-[10px] text-muted-foreground">
          {stat.total_calls} calls · avg {stat.avg_response_ms}ms
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground">{stat.acceptance_rate}%</div>
        <div className="text-[10px] text-muted-foreground">
          {stat.applied_count}✓ {stat.rejected_count}✗
        </div>
      </div>
    </div>
  );
}

function RecentRow({ metric, onFeedback }) {
  const { t } = useTranslation();
  const meta = FEATURE_META[metric.feature] || FEATURE_META.insights;
  const Icon = meta.icon;
  const sts = STATUS_STYLE[metric.status] || STATUS_STYLE.generated;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Icon className={`w-4 h-4 shrink-0 ${meta.color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">
          {metric.feature === 'breakdown'
            ? `${metric.output_data?.count || '?'} subtasks`
            : metric.feature === 'estimate'
              ? `${metric.output_data?.story_points || '?'} SP`
              : metric.feature
          }
        </div>
        <div className="text-[10px] text-muted-foreground">
          {metric.response_time_ms}ms · {formatDistanceToNow(new Date(metric.created_at), {
            addSuffix: true,
            locale: vi,
          })}
        </div>
      </div>
      {metric.status === 'generated' && onFeedback ? (
        <div className="flex items-center gap-1">
          <button onClick={() => onFeedback(metric.id, 'applied')} className="p-1 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-md transition-colors text-muted-foreground" title={t('ai_metrics.accept', 'Accept')}>
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onFeedback(metric.id, 'rejected')} className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-colors text-muted-foreground" title={t('ai_metrics.reject', 'Reject')}>
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${sts.cls}`}>
          {sts.label}
        </span>
      )}
    </div>
  );
}

export default function AIMetricsDashboard({ projectId }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const feedbackMutation = useMutation({
    mutationFn: ({ id, status }) => aiService.submitFeedback(projectId, id, status),
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['ai-metrics', projectId] });
      if (status === 'rejected') {
        qc.invalidateQueries({ queryKey: ['tasks'] });
        qc.invalidateQueries({ queryKey: ['task'] });
      }
    },
    onError: (err) => toast.error(getApiError(err, t('common.error'))),
  });

  // Feedback needs task.update; rejecting a breakdown deletes its subtasks
  const { can } = useProjectPermissions(projectId);
  const handleFeedback = (id, status) => {
    if (feedbackMutation.isPending) return;
    const metric = metrics?.recent?.find(m => m.id === id);
    if (status === 'rejected' && metric?.feature === 'breakdown'
        && !window.confirm(t('ai_metrics.reject_confirm', 'Reject this breakdown and delete the subtasks it created?'))) {
      return;
    }
    feedbackMutation.mutate({ id, status });
  };

  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ['ai-metrics', projectId],
    queryFn: () => aiService.getMetrics(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Card className="glass-surface border border-border/60 p-8 flex items-center justify-center">
        <Cpu className="w-5 h-5 text-muted-foreground animate-spin" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="glass-surface border border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {t('ai_metrics.load_failed', 'Could not load the AI metrics.')}
        </p>
      </Card>
    );
  }

  if (!metrics || metrics.total_ai_calls === 0) {
    return (
      <Card className="glass-surface border border-border/60 p-8 text-center">
        <Brain className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {t('ai_metrics.no_data', 'No AI metrics yet. Use AI Breakdown or Estimate to start tracking.')}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-[color:var(--color-ai)]" />
        <h3 className="text-sm font-semibold text-foreground">
          {t('ai_metrics.title', 'AI Evaluation Metrics')}
        </h3>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Cpu}
          label={t('ai_metrics.total_calls', 'Total AI Calls')}
          value={metrics.total_ai_calls}
        />
        <StatCard
          icon={CheckCircle2}
          label={t('ai_metrics.acceptance', 'Acceptance Rate')}
          value={`${metrics.overall_acceptance_rate}%`}
          color={metrics.overall_acceptance_rate >= 70 ? 'text-emerald-500' : metrics.overall_acceptance_rate >= 40 ? 'text-amber-500' : 'text-red-500'}
        />
        <StatCard
          icon={Clock}
          label={t('ai_metrics.avg_response', 'Avg Response')}
          value={`${metrics.avg_response_ms}ms`}
          color={metrics.avg_response_ms < 3000 ? 'text-emerald-500' : 'text-amber-500'}
        />
        <StatCard
          icon={TrendingUp}
          label={t('ai_metrics.tokens_used', 'Tokens Used')}
          value={metrics.total_tokens_used.toLocaleString()}
          sub="input + output"
        />
      </div>

      {/* Acceptance bar */}
      <Card className="glass-surface border border-border/60 p-4">
        <AcceptanceBar rate={metrics.overall_acceptance_rate} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By feature */}
        <Card className="glass-surface border border-border/60 p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t('ai_metrics.by_feature', 'By Feature')}
          </h4>
          {metrics.by_feature.map((stat) => (
            <FeatureRow key={stat.feature} stat={stat} />
          ))}
        </Card>

        {/* Recent */}
        <Card className="glass-surface border border-border/60 p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            {t('ai_metrics.recent', 'Recent AI Calls')}
          </h4>
          <div className="max-h-[240px] overflow-y-auto">
            {metrics.recent.slice(0, 10).map((m) => (
              <RecentRow key={m.id} metric={m} onFeedback={can('task.update') ? handleFeedback : undefined} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
