function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

// path may be a dotted path, e.g. 'user.firstName' — shared with excel.js so
// both export formats read the same column definitions the same way.
function getPath(obj, path) {
  return path.split('.').reduce((v, k) => (v == null ? v : v[k]), obj);
}

// columns: [{ key, header }] — key may be a dotted path, e.g. 'user.firstName'
function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(getPath(row, c.key))).join(',')).join('\n');
  return `${header}\n${body}`;
}

function sendCsv(res, filename, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(toCsv(rows, columns));
}

module.exports = { toCsv, sendCsv, getPath };
