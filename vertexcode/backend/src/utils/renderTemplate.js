const fs = require('fs');
const path = require('path');

/**
 * Loads an HTML template from `dir` and replaces {{token}} placeholders with `vars`.
 * Unmatched tokens are left blank rather than throwing — templates are trusted,
 * hand-authored files, not user input.
 */
function renderTemplate(dir, name, vars = {}) {
  const filePath = path.join(dir, name);
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ''));
}

module.exports = { renderTemplate };
