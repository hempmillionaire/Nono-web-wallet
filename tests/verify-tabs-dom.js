/**
 * verify-tabs-dom.js — tab panel IDs must match data-tab (regression).
 * Run: node tests/verify-tabs-dom.js
 */
'use strict';
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '../verify.html'), 'utf8');
const tabs = [...html.matchAll(/data-tab="([^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(tabs)];
for (const t of uniq) {
  const id = 'tab-' + t;
  if (!html.includes('id="' + id + '"')) {
    console.error('Missing panel', id, 'for tab', t);
    process.exit(1);
  }
}
console.log('OK tab panels:', uniq.join(', '));