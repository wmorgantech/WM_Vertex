// Minimal RFC4180-style CSV parser (quoted fields, embedded commas/quotes,
// \r\n or \n line endings) — the inverse of utils/csv.js's escaping rules.
// No external dependency: the tabular data this reads (employee import
// rows) doesn't warrant pulling in a parsing library for it.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  // Trailing field/row — the file may or may not end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

// Parses a header row + data rows into an array of { [header]: value }
// objects, keyed by trimmed header text exactly as it appears in the file.
function parseCsvRecords(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const record = {};
    headers.forEach((h, idx) => { record[h] = (r[idx] ?? '').trim(); });
    return record;
  });
}

module.exports = { parseCsv, parseCsvRecords };
