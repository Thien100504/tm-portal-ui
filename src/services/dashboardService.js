import api from '@/lib/axios';

const dashboardService = {
  async getPersonalStats(workspaceId = null) {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const res = await api.get('/dashboard/stats', { params });
    return res.data;
  },

  async getAdminStats() {
    const res = await api.get('/dashboard/admin-stats');
    return res.data;
  },
};

export default dashboardService;
