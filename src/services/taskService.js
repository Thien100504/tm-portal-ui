import api from '@/lib/axios';

const taskService = {
  async getTasks(projectId) {
    const res = await api.get('/tasks', { params: { project_id: projectId } });
    return res.data;
  },

  async getTask(taskId) {
    const res = await api.get(`/tasks/${taskId}`);
    return res.data;
  },

  async createTask(data) {
    const res = await api.post('/tasks', data);
    return res.data;
  },

  async updateTask(taskId, data) {
    const res = await api.put(`/tasks/${taskId}`, data);
    return res.data;
  },

  async deleteTask(taskId) {
    await api.delete(`/tasks/${taskId}`);
  },

  async updateStatus(taskId, status, override = false) {
    const res = await api.put(`/tasks/${taskId}/status`, { status, override });
    return res.data;
  },

  async updatePosition(taskId, status, insertAfterId = null) {
    const res = await api.put(`/tasks/${taskId}/position`, {
      status,
      insert_after_id: insertAfterId,
    });
    return res.data;
  },

  async assignTask(taskId, assigneeId) {
    const res = await api.put(`/tasks/${taskId}/assign`, { assignee_id: assigneeId });
    return res.data;
  },

  async getComments(taskId) {
    const res = await api.get(`/tasks/${taskId}/comments`);
    return res.data;
  },

  async addComment(taskId, content) {
    const res = await api.post(`/tasks/${taskId}/comments`, { content });
    return res.data;
  },

  async addDependency(taskId, dependsOnId) {
    const res = await api.post(`/tasks/${taskId}/dependencies`, { depends_on_id: dependsOnId });
    return res.data;
  },

  async removeDependency(taskId, dependsOnId) {
    const res = await api.delete(`/tasks/${taskId}/dependencies/${dependsOnId}`);
    return res.data;
  },

  async requestAIBreakdown(taskId) {
    const res = await api.post(`/tasks/${taskId}/ai/breakdown`);
    return res.data;
  },

  async requestAIEstimate(taskId) {
    const res = await api.post(`/tasks/${taskId}/ai/estimate`);
    return res.data;
  },

  async getMyDayTasks(workspaceId = null) {
    const params = workspaceId ? { workspace_id: workspaceId } : {};
    const res = await api.get('/tasks/my-day', { params });
    return res.data;
  },

  async getImpactedDependencies(taskId, deltaDays) {
    const res = await api.get(`/tasks/${taskId}/impacted-dependencies`, {
      params: { delta_days: deltaDays },
    });
    return res.data;
  },

  async applyCascadeDeadline(taskId, deltaDays) {
    const res = await api.post(`/tasks/${taskId}/cascade-deadline`, {
      delta_days: deltaDays,
    });
    return res.data;
  },
};

export default taskService;
