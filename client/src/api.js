async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  campaigns: () => request('/campaigns'),
  campaign: (id) => request(`/campaigns/${id}`),
  create: (formData) => request('/campaigns', { method: 'POST', body: formData }),
  retry: (id) => request(`/campaigns/${id}/retry`, { method: 'POST' }),
  remove: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
};
