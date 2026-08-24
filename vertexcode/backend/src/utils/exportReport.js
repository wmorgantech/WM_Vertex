const { sendCsv } = require('./csv');
const { sendXlsx } = require('./excel');

// Single dispatch point for every /reports/* endpoint: same fetched rows,
// same column definitions, formatted for whichever export the caller asked
// for. Default (or ?format=csv) is byte-identical to the existing CSV
// export; ?format=xlsx produces a real workbook via excel.js.
async function sendReport(req, res, baseFilename, rows, columns, opts = {}) {
  if (req.query.format === 'xlsx') {
    return sendXlsx(res, `${baseFilename}.xlsx`, rows, columns, opts);
  }
  return sendCsv(res, `${baseFilename}.csv`, rows, columns);
}

module.exports = { sendReport };
