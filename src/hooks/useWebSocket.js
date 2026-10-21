import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import api, { getAccessToken } from '@/lib/axios';
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
    // Per-run flag: events of a socket from a previous run must not touch this run
    let disposed = false;

    const clearTimers = () => {
      clearInterval(pingTimer.current);
      clearTimeout(pongTimer.current);
      clearTimeout(reconnectTimer.current);
    };

    const scheduleReconnect = () => {
      if (disposed) return;
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
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Read the token on every (re)connect: the axios interceptor may have refreshed it
      const token = getAccessToken() || accessToken;
      const url = projectId
        ? `${protocol}//${window.location.host}/ws/projects/${projectId}?token=${token}`
        : `${protocol}//${window.location.host}/ws/global?token=${token}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed || wsRef.current !== ws) { ws.close(); return; }
        setIsConnected(true);
        attemptRef.current = 0;   // reset backoff on success
        // Refetch cached queries so events missed while disconnected show up
        flushOnReconnect();
        startPing(ws);
      };

      ws.onclose = (event) => {
        // Ignore stale sockets: replaced by a newer one, or closed by the effect cleanup
        if (disposed || wsRef.current !== ws) return;
        setIsConnected(false);
        clearInterval(pingTimer.current);
        clearTimeout(pongTimer.current);
        wsRef.current = null;
        if (event.code === 1008) {
          // Auth failure, usually an expired access token. One API call lets the axios
          // interceptor refresh it; the new token re-runs this effect, which reconnects.
          api.get('/users/me').catch(() => {});
          return;
        }
        // 1001 = server going away
        if (event.code !== 1001) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => { /* onclose fires after onerror, reconnect handled there */ };

      ws.onmessage = (event) => {
        if (wsRef.current !== ws) return; // stale socket
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
      disposed = true;
      clearTimers();
      document.removeEventListener('visibilitychange', onVisible);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        // Detach the handlers first: the close event arrives later, possibly after
        // the next run of this effect has opened a new socket
        ws.onopen = ws.onclose = ws.onmessage = ws.onerror = null;
        ws.close(1000, 'component unmount');
      }
    };
  }, [projectId, accessToken, queryClient, flushOnReconnect]);

  return { isConnected };
}
