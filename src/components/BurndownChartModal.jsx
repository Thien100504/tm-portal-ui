import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import sprintService from '@/services/sprintService';
import { Modal } from '@/components/ui/Modal';

export default function BurndownChartModal({ sprint, onClose }) {
  const { t } = useTranslation();
  const {
    data: chartData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sprint-burndown', sprint.id],
    queryFn: () => sprintService.getSprintBurndown(sprint.id),
  });

  return (
    <Modal
      title={t('sprintBoard.burndown.title', { name: sprint.name })}
      subtitle={t('sprintBoard.burndown.subtitle')}
      maxWidth="max-w-3xl"
      onClose={onClose}
    >
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="w-8 h-8 text-[color:var(--color-ai)] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <AlertCircle className="w-10 h-10 mb-2 text-rose-500" />
            <p>{t('sprintBoard.burndown.no_data')}</p>
          </div>
        ) : (
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  itemStyle={{ fontSize: 12 }}
                  labelStyle={{
                    fontSize: 12,
                    fontWeight: 'bold',
                    color: 'hsl(var(--foreground))',
                    marginBottom: '4px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: '10px' }} />
                <Line
                  type="monotone"
                  dataKey="ideal_hours"
                  name={t('sprintBoard.burndown.ideal')}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="remaining_hours"
                  name={t('sprintBoard.burndown.actual')}
                  stroke="hsl(var(--color-ai))"
                  strokeWidth={3}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Modal>
  );
}
