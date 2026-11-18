import { useQuery } from '@tanstack/react-query';
import rbacService from '@/services/rbacService';

export function useProjectPermissions(projectId) {
  const { data: permissions = [], isLoading, error } = useQuery({
    queryKey: ['rbac', 'permissions', projectId],
    queryFn: () => rbacService.getMyPermissions(projectId),
    enabled: !!projectId, // Only fetch if we have a context
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const can = (permissionCode) => {
    if (!permissions || permissions.length === 0) return false;
    return permissions.includes(permissionCode);
  };

  return {
    permissions,
    can,
    isLoading,
    error
  };
}
