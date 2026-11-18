import api from '@/lib/axios';

const notificationService = {
  async getAll(limit = 50, offset = 0) {
    const res = await api.get(`/notifications?limit=${limit}&offset=${offset}`);
    return res.data;
  },

  async getUnreadCount() {
    const res = await api.get('/notifications/unread-count');
    return res.data.count;
  },

  async markRead(id) {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  async markAllRead() {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  },
};

export default notificationService;
