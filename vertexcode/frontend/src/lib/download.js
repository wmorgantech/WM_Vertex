import api from '../api/axios';

export async function downloadReport(path, fallbackFilename) {
  const res = await api.get(path, { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : fallbackFilename;

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const csvCell = (value) => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Client-side CSV of rows the page already has in memory — for "export the
// selected rows" actions where the server report endpoint exports the whole
// module with no id-filtering support, so a server round-trip would need a
// backend change. columns: [{ key, header }], value looked up via key as a
// simple property path (e.g. 'department.name').
export function downloadCsv(filename, rows, columns) {
  const get = (row, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), row);
  const header = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvCell(get(row, c.key))).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
