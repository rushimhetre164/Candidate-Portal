const API_BASE = '/api'; // using CRA proxy to 127.0.0.1:5000

async function handle(res) {
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!res.ok) {
    const msg = data?.message || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.details = data?.error || text;
    throw err;
  }
  return data;
}

const api = {
  createCandidate: (formData) =>
    fetch(`${API_BASE}/candidate`, { method: 'POST', body: formData }).then(handle),

  uploadVideo: (id, formData) =>
    fetch(`${API_BASE}/candidate/${id}/video`, { method: 'POST', body: formData }).then(handle),

  getCandidate: (id) =>
    fetch(`${API_BASE}/candidate/${id}`).then(handle),
};

export default api;
