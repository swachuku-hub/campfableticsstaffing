// Server-side only. Applies an allowlist so this endpoint can only ever touch
// the handful of fields the staffing dashboard is meant to edit — even if the
// token or this URL ever leaked, it could not be used to rewrite arbitrary
// Airtable fields.

const ALLOWED_FIELDS = new Set([
  'Response Status',
  'Confirmed Assignment',
  'Confirmed Shift Time',
  'Assignment Details'
]);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = process.env.AIRTABLE_BASE_ID || 'app0NzUIKpN6hEYJc';
  const TABLE_ID = process.env.AIRTABLE_VOLUNTEER_TABLE_ID || 'tblVsVMTQE4RrKAMc';

  if (!TOKEN) {
    console.error('AIRTABLE_TOKEN environment variable is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { recordId, fields } = payload;
  if (!recordId || typeof recordId !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing recordId' }) };
  }
  if (!fields || typeof fields !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
  }

  // Strip anything not on the allowlist before it ever reaches Airtable
  const safeFields = {};
  for (const key of Object.keys(fields)) {
    if (ALLOWED_FIELDS.has(key)) safeFields[key] = fields[key];
  }
  if (Object.keys(safeFields).length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No editable fields provided' }) };
  }

  const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${encodeURIComponent(recordId)}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields: safeFields })
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Airtable update error', res.status, text);
      return { statusCode: 502, body: JSON.stringify({ error: 'Update failed' }) };
    }
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Update failed' }) };
  }
};
