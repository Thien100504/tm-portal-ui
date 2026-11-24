import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import authService from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

/**
 * Custom hook that provides auth operations and current user state.
 * Wraps Zustand auth store + TanStack Query mutations/queries.
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth, clearAuth, setUser, setInitialized } = useAuthStore();

  // ---- Query: current user ----
  const currentUserQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const me = await authService.getMe();
      setUser(me);
      return me;
    },
    enabled: isAuthenticated,
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mark initialized once user query settles
  if (isAuthenticated && (currentUserQuery.isSuccess || currentUserQuery.isError)) {
    if (!useAuthStore.getState().isInitialized) {
      setInitialized();
    }
  }

  // ---- Mutation: login ----
  const loginMutation = useMutation({
    mutationFn: (data) => authService.login(data),
    onSuccess: async (tokenResponse) => {
      const me = await authService.getMe();
      setAuth(me, tokenResponse.access_token);
      queryClient.setQueryData(['auth', 'me'], me);
      navigate('/dashboard');
    },
  });

  // ---- Mutation: register ----
  const registerMutation = useMutation({
    mutationFn: (data) => authService.register(data),
    onSuccess: () => {
      navigate('/login');
    },
  });

  // ---- Mutation: logout ----
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
      navigate('/login');
    },
    onError: () => {
      // Even if the server-side logout fails, clear local state
      clearAuth();
      queryClient.clear();
      navigate('/login');
    },
  });

  return {
    // State
    user,
    isAuthenticated,
    isLoading: currentUserQuery.isLoading,

    // Mutations
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,

    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,

    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
