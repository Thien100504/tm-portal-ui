import { useQuery } from '@tanstack/react-query';
import workspaceService from '@/services/workspaceService';
import { useWorkspaceStore } from '@/store/workspaceStore';

export function useActiveWorkspace() {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((state) => state.setActiveWorkspaceId);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.getWorkspaces,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  // Default settings if workspace is loading or not found
  const settings = {
    enable_members: true,
    enable_sprint: true,
    enable_epics: true,
    enable_story_points: true,
    enable_workload: true,
    enable_automation: true,
    enable_ai: true,
    enable_time_tracking: true,
    enable_calendar: true,
    enable_reports: false,
    theme: 'glass',
    ...(activeWorkspace?.settings || {}),
  };

  return {
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || activeWorkspaceId,
    setActiveWorkspaceId,
    workspaces,
    isLoading,
    settings,
  };
}
