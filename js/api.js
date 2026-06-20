/* SpaceX Public API wrapper */
const API = 'https://api.spacexdata.com/v4';

const SpaceXAPI = {
  async get(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`);
    return res.json();
  },

  getUpcomingLaunches() {
    return this.get('/launches/upcoming');
  },

  async getPastLaunches(limit = 40) {
    const data = await this.get('/launches/past');
    return data.slice(-limit).reverse();
  },

  getLaunchpads() {
    return this.get('/launchpads');
  },

  getLandpads() {
    return this.get('/landpads');
  },

  getShips() {
    return this.get('/ships');
  },

  getCrew() {
    return this.get('/crew');
  },

  getRockets() {
    return this.get('/rockets');
  },

  getCompany() {
    return this.get('/company');
  },

  async getStarlink(limit = 800) {
    const data = await this.post('/starlink/query', {
      query: { latitude: { $ne: null } },
      options: {
        limit,
        select: 'latitude longitude height_km velocity_kms spaceTrack launch'
      }
    });
    return data.docs || [];
  },

  getRockets()  { return this.get('/rockets'); },
  getRoadster() { return this.get('/roadster'); },
  getCompany()  { return this.get('/company'); },
  getHistory()  { return this.get('/history'); },
  getCapsules() { return this.get('/capsules'); },

  async getMostReusedCore() {
    const data = await this.post('/cores/query', {
      query: { reuse_count: { $gte: 1 } },
      options: { sort: { reuse_count: -1 }, limit: 1, select: 'serial reuse_count last_update status' }
    });
    return data.docs?.[0] ?? null;
  },

  /* Yahoo Finance via CORS proxy – falls back silently */
  async getStockQuote(symbol) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=10d`;
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      return meta
        ? {
            price: meta.regularMarketPrice,
            prev:  meta.previousClose,
            closes: (closes || []).filter(Boolean).slice(-10)
          }
        : null;
    } catch {
      return null;
    }
  }
};
