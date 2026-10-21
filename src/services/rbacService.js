import api from '@/lib/axios';

const rbacService = {
  async getRoles(scope = 'project', workspaceId = null) {
    const params = { scope };
    if (workspaceId) params.workspace_id = workspaceId;
    const res = await api.get('/roles', { params });
    return res.data;
  },
  async getPermissions() {
    const res = await api.get('/roles/permissions');
    return res.data;
  },
  async getMyPermissions(projectId = null, workspaceId = null) {
    const params = {};
    if (projectId) params.project_id = projectId;
    if (workspaceId) params.workspace_id = workspaceId;
    const res = await api.get('/roles/my-permissions', { params });
    return res.data;
  },
  async createRole(data) {
    const res = await api.post('/roles', data);
    return res.data;
  },
  async updateRole(roleId, data) {
    const res = await api.put(`/roles/${roleId}`, data);
    return res.data;
  },
  async updateRolePermissions(roleId, permissionIds) {
    const res = await api.put(`/roles/${roleId}/permissions`, { permission_ids: permissionIds });
    return res.data;
  },
  async deleteRole(roleId) {
    const res = await api.delete(`/roles/${roleId}`);
    return res.data;
  },
};

export default rbacService;
