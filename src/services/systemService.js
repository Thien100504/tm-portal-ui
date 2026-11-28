import api from '@/lib/axios';

const systemService = {
  async getApiVersion() {
    const res = await api.get('/version');
    return res.data.version;
  },
};

export default systemService;
