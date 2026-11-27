import api from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE = '/api/v1';

// Assistant sidebar sessions: one project, or the whole workspace (projectId empty)
const chatService = {
  /** { configured: false } when the server has no AI key, so the assistant cannot answer */
  async getStatus() {
    const res = await api.get('/chat/status');
    return res.data;
  },

  async listSessions({ workspaceId, projectId }) {
    const res = await api.get('/chat/sessions', {
      params: { workspace_id: workspaceId, ...(projectId ? { project_id: projectId } : {}) },
    });
    return res.data;
  },

  async createSession({ workspaceId, projectId, title }) {
    const res = await api.post('/chat/sessions', {
      workspace_id: workspaceId,
      project_id: projectId || null,
      title,
    });
    return res.data;
  },

  async renameSession(sessionId, title) {
    const res = await api.patch(`/chat/sessions/${sessionId}`, { title });
    return res.data;
  },

  async deleteSession(sessionId) {
    await api.delete(`/chat/sessions/${sessionId}`);
  },

  async getMessages(sessionId) {
    const res = await api.get(`/chat/sessions/${sessionId}/messages`);
    return res.data;
  },

  /**
   * Send a message; resolves to the streaming fetch Response (axios cannot stream).
   * A non-2xx response throws an error shaped like axios's, so getApiError can translate it.
   */
  async streamReply(sessionId, { content, lang }, signal) {
    const token = localStorage.getItem('access_token') || useAuthStore.getState().accessToken;
    const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content, lang }),
      signal,
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.response = { status: res.status, data: await res.json().catch(() => null) };
      throw err;
    }
    return res;
  },
};

export default chatService;
