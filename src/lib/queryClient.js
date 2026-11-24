import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: true, // Refetch automatically when returning to the tab
    },
    mutations: {
      retry: 0,
    },
  },
});

// Cross-tab sync within the same browser (Broadcast Channel)
let isReceivingBroadcast = false;
const channel = new BroadcastChannel('tm_sync_channel');

const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);

// Override invalidateQueries to automatically broadcast to other tabs
queryClient.invalidateQueries = async (filters, options) => {
  const result = originalInvalidateQueries(filters, options);

  if (!isReceivingBroadcast) {
    channel.postMessage({
      type: 'INVALIDATE',
      filters: filters,
    });
  }

  return result;
};

// Listen for signals from other tabs and refetch data
channel.onmessage = (event) => {
  if (event.data?.type === 'INVALIDATE') {
    isReceivingBroadcast = true;
    queryClient.invalidateQueries(event.data.filters).finally(() => {
      isReceivingBroadcast = false;
    });
  }
};
