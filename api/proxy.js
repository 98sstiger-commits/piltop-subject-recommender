export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const body = req.body;

    // web_search tool 포함 시 beta 헤더 자동 추가
    const hasBeta =
      (Array.isArray(body.betas) && body.betas.length > 0) ||
      (Array.isArray(body.tools) && body.tools.some(t => t.type && t.type.startsWith('web_search')));

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (hasBeta) {
      headers['anthropic-beta'] = (Array.isArray(body.betas) && body.betas.length > 0)
        ? body.betas.join(',')
        : 'web-search-20250305';
    }

    // betas 필드는 Anthropic API 스펙에 없으므로 제외
    const { betas, ...forwardBody } = body;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(forwardBody),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
