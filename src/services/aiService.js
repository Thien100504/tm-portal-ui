import api from '@/lib/axios';
import i18n from '@/lib/i18n';

const aiService = {
  /**
   * Get the AI insights of a project.
   * @param {string} projectId
   * @param {string} [lang] - 'vi' | 'en' — override the language (defaults to the current i18n language)
   * @returns {Promise<AIInsightsResponse>}
   */
  async getInsights(projectId, lang = null) {
    const resolvedLang = lang || (i18n.language?.startsWith('vi') ? 'vi' : 'en');
    const res = await api.get(`/projects/${projectId}/ai-insights`, {
      params: { lang: resolvedLang },
    });
    return res.data;
  },

  async getMetrics(projectId) {
    const res = await api.get(`/projects/${projectId}/ai-metrics`);
    return res.data;
  },

  async getLatestMetric(projectId, taskId, feature) {
    const res = await api.get(`/projects/${projectId}/ai-metrics`);
    const metrics = res.data?.recent || [];
    return metrics.find(
      (m) => m.task_id === taskId && m.feature === feature && m.status === 'generated'
    ) || null;
  },

  async submitFeedback(projectId, metricId, status, feedbackNote = null) {
    const res = await api.patch(`/projects/${projectId}/ai-metrics/${metricId}`, {
      status,
      feedback_note: feedbackNote,
    });
    return res.data;
  },
};

export default aiService;
