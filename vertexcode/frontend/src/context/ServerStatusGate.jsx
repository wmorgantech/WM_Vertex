import { useEffect, useState } from 'react';
import api, { isServerAvailable, onServerAvailabilityChange } from '../api/axios';
import MaintenancePage from '../pages/Maintenance/MaintenancePage';

// While the maintenance screen is showing, ping a lightweight, always-existing
// endpoint on a fixed interval so the app recovers on its own as soon as the
// server comes back — no need for the user to click Reload. This is bounded
// (cleared the moment the server is back up) rather than an open-ended loop,
// and reuses the existing `api` client/interceptor: the interceptor's own
// success/failure handling (see api/axios.js) is what actually flips the
// status, this timer just needs to keep giving it something to react to.
const RETRY_INTERVAL_MS = 15000;

export default function ServerStatusGate({ children }) {
  const [down, setDown] = useState(!isServerAvailable());

  useEffect(() => onServerAvailabilityChange((available) => setDown(!available)), []);

  useEffect(() => {
    if (!down) return undefined;
    const id = setInterval(() => {
      api.get('/auth/me').catch(() => {});
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [down]);

  if (down) return <MaintenancePage />;

  return children;
}
