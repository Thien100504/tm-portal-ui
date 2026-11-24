import api from '@/lib/axios';

const searchService = {
  /**
   * Search globally across projects, tasks, and users in a workspace
   * @param {string} query - The search keyword
   * @param {string} workspaceId - The current workspace ID
   * @returns {Promise<{projects: Array, tasks: Array, users: Array}>}
   */
  globalSearch: async (query, workspaceId) => {
    if (!query || !workspaceId) return { projects: [], tasks: [], users: [] };
    const response = await api.get('/search', {
      params: {
        q: query,
        workspace_id: workspaceId,
      },
    });
    return response.data;
  },
};

export default searchService;
