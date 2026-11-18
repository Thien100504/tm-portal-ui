import api from '@/lib/axios';

const sprintService = {
  async getSprints(projectId) {
    const res = await api.get(`/projects/${projectId}/sprints`);
    return res.data;
  },

  async createSprint(projectId, data) {
    const res = await api.post(`/projects/${projectId}/sprints`, data);
    return res.data;
  },

  async updateSprint(sprintId, data) {
    const res = await api.put(`/sprints/${sprintId}`, data);
    return res.data;
  },

  async deleteSprint(sprintId) {
    await api.delete(`/sprints/${sprintId}`);
  },

  /** Start a sprint (planning → active) */
  async startSprint(sprintId) {
    const res = await api.post(`/sprints/${sprintId}/start`);
    return res.data;
  },

  /** Reopen a completed sprint (completed → active) */
  async reopenSprint(sprintId) {
    const res = await api.post(`/sprints/${sprintId}/reopen`);
    return res.data;
  },

  /**
   * Complete a sprint (active → completed)
   * @param {string} sprintId
   * @param {'backlog'|'next_sprint'} incompleteAction
   * @param {string|null} targetSprintId - required when incompleteAction = 'next_sprint'
   */
  async completeSprint(sprintId, incompleteAction, targetSprintId = null) {
    const res = await api.post(`/sprints/${sprintId}/complete`, {
      incomplete_action: incompleteAction,
      target_sprint_id: targetSprintId || undefined,
    });
    return res.data;
  },

  /** Sprint stats: total, done, completion_rate, velocity, actual_days */
  async getSprintStats(sprintId) {
    const res = await api.get(`/sprints/${sprintId}/stats`);
    return res.data;
  },

  async getSprintBurndown(sprintId) {
    const res = await api.get(`/sprints/${sprintId}/burndown`);
    return res.data;
  },
};

export default sprintService;
