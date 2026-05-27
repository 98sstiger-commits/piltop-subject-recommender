const NEIS_KEY = '0e64c7c2b82142bfa57843bdb1b2d98f';
const BASE = 'https://open.neis.go.kr/hub';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action, schoolName, atpt_code, school_code, grade } = req.body;

  try {
    // ── 학교 검색 ──────────────────────────────────
    if (action === 'search') {
      const params = new URLSearchParams({
        KEY: NEIS_KEY, Type: 'json', pIndex: 1, pSize: 20,
        SCHUL_NM: schoolName, SCHUL_KND_SC_NM: '고등학교'
      });
      const r = await fetch(`${BASE}/schoolInfo?${params}`);
      const d = await r.json();
      const rows = d?.schoolInfo?.[1]?.row || [];
      const schools = rows.map(s => ({
        name: s.SCHUL_NM,
        atpt_code: s.ATPT_OFCDC_SC_CODE,
        atpt_name: s.ATPT_OFCDC_SC_NM,
        school_code: s.SD_SCHUL_CODE,
        address: s.ORG_RDNMA || '',
        region: s.LCTN_SC_NM || ''
      }));
      return res.status(200).json({ schools });
    }

    // ── 개설과목 추출 ──────────────────────────────
    if (action === 'subjects') {
      const year = new Date().getFullYear();
      const subjects = new Set();

      // 1학기 + 2학기 모두 조회, pSize=1000으로 2페이지
      for (const sem of ['1', '2']) {
        for (const pIndex of [1, 2]) {
          const params = new URLSearchParams({
            KEY: NEIS_KEY, Type: 'json',
            pIndex, pSize: 1000,
            ATPT_OFCDC_SC_CODE: atpt_code,
            SD_SCHUL_CODE: school_code,
            AY: year, SEM: sem, GRADE: grade
          });
          const r = await fetch(`${BASE}/hisTimetable?${params}`);
          const d = await r.json();
          const rows = d?.hisTimetable?.[1]?.row || [];
          if (rows.length === 0) break;
          rows.forEach(row => {
            const s = row.ITRT_CNTNT;
            if (s && !s.startsWith('[') && s.trim()) subjects.add(s.trim());
          });
          if (rows.length < 1000) break;
        }
      }

      return res.status(200).json({ subjects: [...subjects].sort() });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error('school API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
