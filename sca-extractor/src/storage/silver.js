const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

async function saveJson({ kind, studentId, pageIndex, data }) {
  const date = new Date().toISOString().slice(0, 10);
  const safeId = studentId ? String(studentId) : 'unknown';
  const dir = path.join(config.storage.dataDir, 'silver', kind, date);
  await fs.mkdir(dir, { recursive: true });
  const filename = kind === 'profiles'
    ? `${safeId}.json`
    : `page-${String(pageIndex || 1).padStart(3, '0')}.json`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

module.exports = { saveJson };
