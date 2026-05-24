export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const SB_URL = 'https://zmtldohklivkzpfdyflc.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptdGxkb2hrbGl2a3pwZmR5ZmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjgxMDQsImV4cCI6MjA4ODU0NDEwNH0.cv1WrvDzNedVZABWyRCS9ARRxf4Si9qgeUqEvhpHWlo';

  try {
    const data = req.body;
    const id = Math.random().toString(36).substr(2, 6).toUpperCase();
    const key = `curricula_${id}`;

    const r = await fetch(`${SB_URL}/rest/v1/piltop_data`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        key,
        value: `${data.form?.career || ''} ${data.form?.major || ''}`.trim(),
        jsonb: data
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Supabase error:', r.status, errText);
      return res.status(500).json({ error: `Supabase ${r.status}: ${errText}` });
    }

    return res.status(200).json({ id });
  } catch (e) {
    console.error('Store error:', e);
    return res.status(500).json({ error: e.message });
  }
}
