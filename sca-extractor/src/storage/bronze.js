const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

async function saveHtml({ kind, studentId, pageIndex, html }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeId = studentId ? String(studentId) : 'unknown';
  const dir = path.join(config.storage.dataDir, 'bronze', kind, date);
  await fs.mkdir(dir, { recursive: true });
  const filename = kind === 'profiles'
    ? `${safeId}.html`
    : `page-${String(pageIndex || 1).padStart(3, '0')}.html`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, html);
  return filePath;
}

module.exports = { saveHtml };
