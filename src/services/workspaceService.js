import api from '@/lib/axios';

const workspaceService = {
  async getWorkspaces() {
    const res = await api.get('/workspaces');
    return res.data;
  },

  async createWorkspace(data) {
    const res = await api.post('/workspaces', data);
    return res.data;
  },

  async getWorkspace(id) {
    const res = await api.get(`/workspaces/${id}`);
    return res.data;
  },

  async updateWorkspace(id, data) {
    const res = await api.put(`/workspaces/${id}`, data);
    return res.data;
  },

  async deleteWorkspace(id) {
    await api.delete(`/workspaces/${id}`);
  },

  async getMembers(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}/members`);
    return res.data;
  },

  async getInvitations(workspaceId) {
    const res = await api.get(`/workspaces/${workspaceId}/invitations`);
    return res.data;
  },

  async inviteMember(workspaceId, data) {
    const res = await api.post(`/workspaces/${workspaceId}/members/invite`, data);
    return res.data;
  },

  async updateMember(workspaceId, userId, data) {
    const res = await api.put(`/workspaces/${workspaceId}/members/${userId}`, data);
    return res.data;
  },

  async removeMember(workspaceId, userId) {
    await api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  },

  async cancelInvitation(workspaceId, inviteId) {
    await api.delete(`/workspaces/${workspaceId}/invitations/${inviteId}`);
  }
};

export default workspaceService;
