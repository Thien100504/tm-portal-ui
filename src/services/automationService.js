import api from '@/lib/axios';

const automationService = {
  async getRules(projectId) {
    const res = await api.get(`/projects/${projectId}/automations`);
    return res.data;
  },

  async createRule(projectId, data) {
    const res = await api.post(`/projects/${projectId}/automations`, data);
    return res.data;
  },

  async updateRule(ruleId, data) {
    const res = await api.put(`/automations/${ruleId}`, data);
    return res.data;
  },

  async deleteRule(ruleId) {
    await api.delete(`/automations/${ruleId}`);
  },

  async toggleRule(ruleId) {
    const res = await api.patch(`/automations/${ruleId}/toggle`);
    return res.data;
  },
};

export default automationService;
