import api from '@/lib/axios';

const adminService = {
  async listUsers() {
    const res = await api.get('/admin/users');
    return res.data;
  },

  async updateUserRole(userId, role) {
    const res = await api.put(`/admin/users/${userId}/role`, { role });
    return res.data;
  },

  async updateUserStatus(userId, isActive) {
    const res = await api.put(`/admin/users/${userId}/status`, { is_active: isActive });
    return res.data;
  },

  async listWorkspaces() {
    const res = await api.get('/admin/workspaces');
    return res.data;
  },

  async updateUserProfile(userId, data) {
    const res = await api.put(`/admin/users/${userId}/profile`, data);
    return res.data;
  },

  async resetPassword(userId, newPassword) {
    const res = await api.put(`/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
    });
    return res.data;
  },
};

export default adminService;
