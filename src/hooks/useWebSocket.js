import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';

const PING_INTERVAL_MS  = 25_000;   // send ping every 25s
const PONG_TIMEOUT_MS   = 5_000;    // if no pong within 5s → dead connection
const BACKOFF_BASE_MS   = 1_000;    // first reconnect after 1s
const BACKOFF_MAX_MS    = 30_000;   // cap at 30s
const BACKOFF_FACTOR    = 2;

export function useWebSocket(projectId = null, onNotification = null) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef             = useRef(null);
  const reconnectTimer    = useRef(null);
  const pingTimer         = useRef(null);
  const pongTimer         = useRef(null);
  const attemptRef        = useRef(0);
  const unmountedRef      = useRef(false);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);

  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  // Flush all relevant queries on reconnect to recover missed messages
  const flushOnReconnect = useCallback(() => {
    if (projectId) {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    }
    queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [projectId, queryClient]);

  useEffect(() => {
    if (!accessToken) {
      setIsConnected(false);
      return;
    }
    unmountedRef.current = false;

    const clearTimers = () => {
      clearInterval(pingTimer.current);
      clearTimeout(pongTimer.current);
      clearTimeout(reconnectTimer.current);
    };

    const scheduleReconnect = () => {
      if (unmountedRef.current) return;
      const delay = Math.min(
        BACKOFF_BASE_MS * Math.pow(BACKOFF_FACTOR, attemptRef.current),
        BACKOFF_MAX_MS
      );
      attemptRef.current += 1;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    const startPing = (ws) => {
      clearInterval(pingTimer.current);
      pingTimer.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send('ping');
        // Expect pong within PONG_TIMEOUT_MS, else force-close
        clearTimeout(pongTimer.current);
        pongTimer.current = setTimeout(() => {
          console.warn('⚠️ WS pong timeout — forcing reconnect');
          ws.close(4000, 'pong timeout');
        }, PONG_TIMEOUT_MS);
      }, PING_INTERVAL_MS);
    };

    const connect = () => {
      if (unmountedRef.current) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = projectId
        ? `${protocol}//${window.location.host}/ws/projects/${projectId}?token=${accessToken}`
        : `${protocol}//${window.location.host}/ws/global?token=${accessToken}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        attemptRef.current = 0;   // reset backoff on success
        // If this is a reconnect (attempt > 0 was reset), flush cache for missed events
        flushOnReconnect();
        startPing(ws);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        clearInterval(pingTimer.current);
        clearTimeout(pongTimer.current);
        wsRef.current = null;
        // 1008 = auth failure, 1001 = clean close (unmount) — don't reconnect
        if (event.code !== 1008 && event.code !== 1001 && !unmountedRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => { /* onclose fires after onerror, reconnect handled there */ };

      ws.onmessage = (event) => {
        // Server pong — cancel the dead-connection timer
        if (event.data === 'pong') {
          clearTimeout(pongTimer.current);
          return;
        }

        try {
          const data = JSON.parse(event.data);

          if (data.action === 'invalidate' && data.entity === 'tasks') {
            const currentUser = useAuthStore.getState().user;
            if (data.actor_id && currentUser && data.actor_id === currentUser.id) return;
            queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
            queryClient.invalidateQueries({ queryKey: ['task'] });
          }

          if (data.action === 'invalidate' && data.entity === 'comments') {
            queryClient.invalidateQueries({ queryKey: ['comments', data.task_id] });
          }

          if (data.action === 'notification') {
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            onNotificationRef.current?.(data);
          }

          if (data.action === 'workspace_updated') {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
          }
        } catch {
          // non-JSON frame — ignore
        }
      };
    };

    connect();

    // Reconnect when tab regains visibility (catches missed events while hidden)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          clearTimeout(reconnectTimer.current);
          attemptRef.current = 0;
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unmountedRef.current = true;
      clearTimers();
      document.removeEventListener('visibilitychange', onVisible);
      wsRef.current?.close(1000, 'component unmount');
    };
  }, [projectId, accessToken, queryClient, flushOnReconnect]);

  return { isConnected };
}
