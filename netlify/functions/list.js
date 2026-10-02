// Server-side only. Reads AIRTABLE_TOKEN from an environment variable
// (Site configuration -> Environment variables). Never hardcode the token here.

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const TOKEN = process.env.AIRTABLE_TOKEN;
  const BASE_ID = process.env.AIRTABLE_BASE_ID || 'app0NzUIKpN6hEYJc';
  const TABLE_ID = process.env.AIRTABLE_VOLUNTEER_TABLE_ID || 'tblVsVMTQE4RrKAMc';

  if (!TOKEN) {
    console.error('AIRTABLE_TOKEN environment variable is not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  try {
    let records = [];
    let offset;
    do {
      let url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?pageSize=100`;
      if (offset) url += `&offset=${offset}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (!res.ok) {
        const text = await res.text();
        console.error('Airtable error', res.status, text);
        return { statusCode: 502, body: JSON.stringify({ error: 'Could not load volunteer data' }) };
      }
      const data = await res.json();
      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not load volunteer data' }) };
  }
};
