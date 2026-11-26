import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import epicService from '@/services/epicService';
import taskService from '@/services/taskService';

/**
 * Epics and stories of a project, shared by the task forms, the board and
 * the roadmap. Uses the same query keys as the pages, so nothing is fetched twice.
 */
export function useTaskHierarchy(projectId) {
  const { t } = useTranslation();
  const { data: epics = [], isLoading: epicsLoading } = useQuery({
    queryKey: ['epics', projectId],
    queryFn: () => epicService.getEpics({ projectId }),
    enabled: !!projectId,
  });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => taskService.getTasks(projectId),
    enabled: !!projectId,
  });

  return useMemo(() => {
    const live = tasks.filter((task) => !task.is_deleted);
    const epicsById = Object.fromEntries(epics.map((e) => [e.id, e]));
    const tasksById = Object.fromEntries(live.map((task) => [task.id, task]));
    const stories = live.filter((task) => task.type === 'story' && !task.parent_task_id);

    const epicOptions = [
      { value: '', label: t('hierarchy.no_epic') },
      ...epics.map((e) => ({
        value: e.id,
        label: e.name,
        icon: (
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: e.color || '#3b82f6' }}
          />
        ),
      })),
    ];

    // Stories a task can be moved under; keeps a legacy non-story parent selectable
    const storyOptionsFor = (task) => {
      const list = stories.filter((s) => s.id !== task?.id);
      const current = task?.parent_task_id && tasksById[task.parent_task_id];
      if (current && !list.some((s) => s.id === current.id)) list.unshift(current);
      return [
        { value: '', label: t('hierarchy.no_story') },
        ...list.map((s) => ({ value: s.id, label: s.title })),
      ];
    };

    return {
      epics,
      epicsById,
      tasks: live,
      tasksById,
      stories,
      epicOptions,
      storyOptionsFor,
      isLoading: epicsLoading || tasksLoading,
    };
  }, [epics, tasks, epicsLoading, tasksLoading, t]);
}
