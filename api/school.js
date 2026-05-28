const NEIS_KEY = '0e64c7c2b82142bfa57843bdb1b2d98f';
const BASE = 'https://open.neis.go.kr/hub';

// ── A안: NEIS 과목명 → 2022 개정 표준 과목명 정규화 매핑 ──
const NAME_MAP = {
  // 수학
  '수학Ⅰ': '대수', '수학1': '대수',
  '수학Ⅱ': '미적분Ⅱ', '수학2': '미적분Ⅱ',
  '미적분': '미적분Ⅱ',
  // 과학
  '물리학Ⅰ': '물리학', '물리학1': '물리학',
  '물리Ⅰ': '물리학',
  '화학Ⅰ': '화학', '화학1': '화학',
  '생명과학Ⅰ': '생명과학', '생명과학1': '생명과학',
  '지구과학Ⅰ': '지구과학', '지구과학1': '지구과학',
  '물리학Ⅱ': '역학과에너지', // 2015 Ⅱ → 2022 융합선택
  '화학Ⅱ': '화학반응의세계',
  '생명과학Ⅱ': '세포와물질대사',
  '지구과학Ⅱ': '지구시스템과학',
  // 영어
  '영어Ⅰ': '영어Ⅰ', // 유지
  '영어Ⅱ': '영어Ⅱ',
  // 제2외국어
  '일본어Ⅰ': '일본어',
  '중국어Ⅰ': '중국어',
  '프랑스어Ⅰ': '프랑스어',
  '독일어Ⅰ': '독일어',
  '스페인어Ⅰ': '스페인어',
  // 음악/미술 표기 통일
  '음악 연주': '음악 연주와 창작',
  '음악연주': '음악 연주와 창작',
};

function normalizeName(s) {
  return NAME_MAP[s] || NAME_MAP[s.trim()] || s;
}

// 비과목 필터
const NON_SUBJECT_PATTERNS = [
  '지필평가','수행평가','고사','시험','평가일','연합학력평가','전국연합',
  '모의고사','학력평가','진단평가','성취도평가',
  '활동','행사','총회','축제','캠프','견학','봉사',
  '조회','기념일','휴업일','재량','자율','토요',
  '학부모','보강','대체','노동절','어린이날','자기주도',
  '졸업','입학','수학여행','현장체험'
];

function isValidSubject(s) {
  if (!s || s.trim().length < 2) return false;
  if (s.startsWith('[')) return false;
  if (!/[가-힣]/.test(s)) return false;
  if (NON_SUBJECT_PATTERNS.some(k => s.includes(k))) return false;
  return true;
}

async function fetchTimetable(atpt_code, school_code, year, grade, sem, pIndex) {
  const params = new URLSearchParams({
    KEY: NEIS_KEY, Type: 'json', pIndex, pSize: 1000,
    ATPT_OFCDC_SC_CODE: atpt_code,
    SD_SCHUL_CODE: school_code,
    AY: year, SEM: sem, GRADE: grade
  });
  const r = await fetch(`${BASE}/hisTimetable?${params}`);
  const d = await r.json();
  return d?.hisTimetable?.[1]?.row || [];
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

      // 병렬 조회
      const tasks = [];
      for (const g of grades) {
        for (const sem of ['1', '2']) {
          tasks.push(fetchTimetable(atpt_code, school_code, year, g, sem, 1));
        }
      }
      const results = await Promise.all(tasks);

      // 2페이지 필요한 경우 추가 조회
      const extraTasks = [];
      for (let i = 0; i < tasks.length; i++) {
        if (results[i].length >= 1000) {
          const g = grades[Math.floor(i / 2)];
          const sem = i % 2 === 0 ? '1' : '2';
          extraTasks.push(fetchTimetable(atpt_code, school_code, year, g, sem, 2));
        }
      }
      const extraResults = extraTasks.length > 0 ? await Promise.all(extraTasks) : [];

      [...results, ...extraResults].forEach(rows => {
        rows.forEach(row => {
          const raw = (row.ITRT_CNTNT || '').trim();
          if (!isValidSubject(raw)) return;
          // A안: 과목명 정규화 적용
          const normalized = normalizeName(raw);
          subjects.add(normalized);
        });
      });

      return res.status(200).json({ subjects: [...subjects].sort() });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
