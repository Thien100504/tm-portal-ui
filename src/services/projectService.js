import api from '@/lib/axios';

const projectService = {
  async getProjects(workspaceId) {
    const res = await api.get('/projects', { params: workspaceId ? { workspace_id: workspaceId } : {} });
    return res.data;
  },

  async getProject(projectId) {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  },

  async getMembers(projectId) {
    const res = await api.get(`/projects/${projectId}/members`);
    return res.data;
  },

  async createProject(data) {
    const activeWorkspaceId = localStorage.getItem('active-workspace-id');
    const payload = {
      ...data,
      workspace_id: activeWorkspaceId || undefined
    };
    const res = await api.post('/projects', payload);
    return res.data;
  },

  async updateProject(projectId, data) {
    const res = await api.put(`/projects/${projectId}`, data);
    return res.data;
  },

  async deleteProject(projectId) {
    await api.delete(`/projects/${projectId}`);
  },

  async addMember(projectId, userId, roleId, projectRole = 'member') {
    const res = await api.post(`/projects/${projectId}/members`, {
      user_id: userId,
      role_id: roleId,
      project_role: projectRole,
    });
    return res.data;
  },

  async updateMember(projectId, userId, data) {
    const res = await api.put(`/projects/${projectId}/members/${userId}`, data);
    return res.data;
  },

  async removeMember(projectId, userId) {
    await api.delete(`/projects/${projectId}/members/${userId}`);
  },
};

export default projectService;
