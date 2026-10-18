import axios from '../lib/axios';

const userService = {
  searchUsers: async (query) => {
    const response = await axios.get('/users/search', { params: { q: query } });
    return response.data;
  },
  updateMe: async (data) => {
    const response = await axios.put('/users/me', data);
    return response.data;
  },
};

export default userService;
