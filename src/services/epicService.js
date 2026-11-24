import api from '@/lib/axios';

const epicService = {
  async getEpics({ workspaceId, projectId }) {
    const params = {};
    if (workspaceId) params.workspace_id = workspaceId;
    if (projectId) params.project_id = projectId;
    const res = await api.get('/epics', { params });
    return res.data;
  },

  async createEpic(data) {
    const res = await api.post('/epics', data);
    return res.data;
  },

  async getEpic(id) {
    const res = await api.get(`/epics/${id}`);
    return res.data;
  },

  async updateEpic(id, data) {
    const res = await api.put(`/epics/${id}`, data);
    return res.data;
  },

  async deleteEpic(id) {
    await api.delete(`/epics/${id}`);
  },
};

export default epicService;
