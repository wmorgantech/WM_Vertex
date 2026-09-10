import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5111/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vertexwm_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// --- Server-availability detection -------------------------------------
// A tiny framework-agnostic pub/sub, kept here since every request in the
// app (including AuthContext's own bootstrap /auth/me check) already flows
// through this one interceptor. A request that never got an HTTP response
// at all (network error, connection refused, timeout) or a 502/503/504
// gateway status means the server itself is unreachable; any other status
// (400/401/403/404, or a plain 500 from one broken request) means the
// server IS up, so those must never flip this flag.
const GATEWAY_DOWN_STATUSES = [502, 503, 504];
function isServerUnavailableError(error) {
  if (!error.response) return true;
  return GATEWAY_DOWN_STATUSES.includes(error.response.status);
}

const availabilityListeners = new Set();
let serverAvailable = true;
function setServerAvailable(available) {
  if (available === serverAvailable) return;
  serverAvailable = available;
  availabilityListeners.forEach((cb) => cb(available));
}
export function onServerAvailabilityChange(callback) {
  availabilityListeners.add(callback);
  return () => availabilityListeners.delete(callback);
}
export function isServerAvailable() {
  return serverAvailable;
}
// -------------------------------------------------------------------------

let isRefreshing = false;
let queue = [];
let redirectingToLogin = false;

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => {
    setServerAvailable(true);
    return res;
  },
  async (error) => {
    setServerAvailable(!isServerUnavailableError(error));

    const original = error.config;
    if (error.response?.status === 401 && !original._retry && original.url !== '/auth/login') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;
      const refreshToken = localStorage.getItem('vertexwm_refresh_token');

      try {
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        localStorage.setItem('vertexwm_access_token', newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // A genuinely unreachable server is not the same as an invalid/expired
        // session — logging the user out and redirecting to a login page the
        // server also can't serve would be actively wrong, so only clear the
        // session and redirect when the refresh actually failed on its own
        // terms (bad/expired token), not when the server itself is down.
        // `axios.isAxiosError` is required here: when there's simply no
        // refresh token to send, the code above throws a plain Error (never
        // sent a request at all), which also has no `.response` — without
        // this guard that "not logged in" case would be misread as the
        // server being down for every anonymous /auth/me probe.
        if (axios.isAxiosError(refreshError) && isServerUnavailableError(refreshError)) {
          setServerAvailable(false);
        } else {
          localStorage.removeItem('vertexwm_access_token');
          localStorage.removeItem('vertexwm_refresh_token');
          localStorage.removeItem('vertexwm_user');
          if (!redirectingToLogin && window.location.pathname !== '/login') {
            redirectingToLogin = true;
            window.location.replace('/login');
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
