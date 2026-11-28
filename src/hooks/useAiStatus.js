import { useQuery } from '@tanstack/react-query';
import chatService from '@/services/chatService';

/** Whether the server can run the assistant. Unknown (loading, error) counts as available. */
export function useAiStatus(enabled = true) {
  const { data } = useQuery({
    queryKey: ['aiStatus'],
    queryFn: chatService.getStatus,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { configured: data?.configured !== false };
}
