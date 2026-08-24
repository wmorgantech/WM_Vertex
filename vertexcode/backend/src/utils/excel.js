const ExcelJS = require('exceljs');
const { getPath } = require('./csv');

// Column `type` drives cell formatting — shared with the CSV column defs
// (csv.js ignores the extra property), so a single column list feeds both
// export formats and nothing about the report logic is duplicated.
const NUM_FORMATS = {
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
  currency: '"₹"#,##0.00',
  number: '#,##0.##',
};

function cellValue(raw, type) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (type === 'date' || type === 'datetime') {
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (type === 'currency' || type === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }
  return raw;
}

// columns: [{ key, header, type?, width? }] — key may be a dotted path.
// opts.totals: column keys to sum into a bold totals row at the bottom
// (only for columns the report already reports a total for).
async function sendXlsx(res, filename, rows, columns, opts = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VertexWM';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(opts.sheetName || 'Report');

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.max(c.header.length + 2, 12),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const row of rows) {
    const data = {};
    for (const c of columns) data[c.key] = cellValue(getPath(row, c.key), c.type);
    const excelRow = sheet.addRow(data);
    for (const c of columns) {
      if (NUM_FORMATS[c.type]) excelRow.getCell(c.key).numFmt = NUM_FORMATS[c.type];
    }
  }

  if (opts.totals?.length && rows.length) {
    const totalsData = {};
    for (const key of opts.totals) {
      totalsData[key] = rows.reduce((sum, r) => sum + (Number(getPath(r, key)) || 0), 0);
    }
    const labelKey = columns.find((c) => !opts.totals.includes(c.key))?.key;
    if (labelKey) totalsData[labelKey] = opts.totalsLabel || 'TOTAL';

    const totalsRow = sheet.addRow(totalsData);
    totalsRow.font = { bold: true };
    totalsRow.eachCell((cell) => { cell.border = { top: { style: 'thin' } }; });
    for (const c of columns) {
      if (opts.totals.includes(c.key) && NUM_FORMATS[c.type]) totalsRow.getCell(c.key).numFmt = NUM_FORMATS[c.type];
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  return res.end();
}

module.exports = { sendXlsx };
