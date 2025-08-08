'use strict';

function parseList(v) {
  return (v || '')
    .split(',')
    .map(s => String(s || '').trim().toLowerCase())
    .filter(Boolean);
}

function getDefaultViewerEmails() {
  const list = parseList(process.env.DEFAULT_VIEWER_EMAILS);
  if (list.length) return Array.from(new Set(list));
  const fallback = String(process.env.DEFAULT_AGENT_EMAIL || '').trim().toLowerCase();
  if (fallback) return [fallback];
  return ['admin@company.com']; // último recurso temporal
}

module.exports = { getDefaultViewerEmails }; 