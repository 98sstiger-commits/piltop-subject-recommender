const NEIS_KEY = '0e64c7c2b82142bfa57843bdb1b2d98f';
const BASE = 'https://open.neis.go.kr/hub';

// 2015개정 과목명 (제외)
const OLD_CURRICULUM = ['물리학Ⅱ','화학Ⅱ','생명과학Ⅱ','지구과학Ⅱ'];

// 과목이 아닌 키워드들
const NON_SUBJECT_PATTERNS = [
  '지필평가','수행평가','고사','시험','평가일','평가기간',
  '활동','행사','총회','축제','캠프','견학','봉사',
  '조회','기념일','휴업일','재량','자율','토요',
  '학부모','보강','대체','노동절','어린이날','자기주도'
];

function isValidSubject(s) {
  if (!s || s.trim().length < 2) return false;
  if (s.startsWith('[')) return false;
  if (!/[가-힣]/.test(s)) return false;
  if (NON_SUBJECT_PATTERNS.some(k => s.includes(k))) return false;
  if (OLD_CURRICULUM.some(k => s.includes(k))) return false;
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action, schoolName, atpt_code, school_code, grade } = req.body;

  try {
    if (action === 'search') {
      const params = new URLSearchParams({
        KEY: NEIS_KEY, Type: 'json', pIndex: 1, pSize: 20,
        SCHUL_NM: schoolName, SCHUL_KND_SC_NM: '고등학교'
      });
      const r = await fetch(`${BASE}/schoolInfo?${params}`);
      const d = await r.json();
      const rows = d?.schoolInfo?.[1]?.row || [];
      return res.status(200).json({
        schools: rows.map(s => ({
          name: s.SCHUL_NM,
          atpt_code: s.ATPT_OFCDC_SC_CODE,
          atpt_name: s.ATPT_OFCDC_SC_NM,
          school_code: s.SD_SCHUL_CODE,
          address: s.ORG_RDNMA || '',
          region: s.LCTN_SC_NM || ''
        }))
      });
    }

    if (action === 'subjects') {
      const year = new Date().getFullYear();
      const subjects = new Set();
      const grades = Array.isArray(grade) ? grade : [grade];

      for (const g of grades) {
        for (const sem of ['1', '2']) {
          for (let pIndex = 1; pIndex <= 5; pIndex++) {
            const params = new URLSearchParams({
              KEY: NEIS_KEY, Type: 'json', pIndex, pSize: 1000,
              ATPT_OFCDC_SC_CODE: atpt_code,
              SD_SCHUL_CODE: school_code,
              AY: year, SEM: sem, GRADE: g
            });
            const r = await fetch(`${BASE}/hisTimetable?${params}`);
            const d = await r.json();
            const rows = d?.hisTimetable?.[1]?.row || [];
            if (rows.length === 0) break;
            rows.forEach(row => {
              const s = (row.ITRT_CNTNT || '').trim();
              if (isValidSubject(s)) subjects.add(s);
            });
            if (rows.length < 1000) break;
          }
        }
      }

      return res.status(200).json({ subjects: [...subjects].sort() });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
