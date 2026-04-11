/**
 * serenkit 캡처 도구
 * Puppeteer를 사용하여 serenkit의 계산기/도구 페이지를 캡처합니다.
 * - 기본 양식 이미지와 결과 이미지, 총 2장을 저장합니다.
 * - 광고 영역은 제외하고 콘텐츠 영역만 캡처합니다.
 */

const puppeteer = require('puppeteer');
const readline  = require('readline');
const path      = require('path');
const fs        = require('fs');

// ─── 설정 파일 로드 ─────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {
  outputPath:        path.join(__dirname, 'output'),
  baseUrl:           'https://serenkit.com',
  viewportWidth:     1440,
  viewportHeight:    900,
  deviceScaleFactor: 2,
};
if (fs.existsSync(CONFIG_PATH)) {
  try { Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))); }
  catch (e) { console.warn('[경고] config.json 파싱 실패, 기본값 사용'); }
}

// ─── serenkit 전체 URL 목록 및 파라미터 정의 ──────────────────────────────
const TOOLS = [
  // ── 날짜·시간 ───────────────────────────────────────────────────────────
  {
    id:       'dday',
    name:     'D-day 계산기',
    category: '날짜·시간',
    url:      '/cal/dday/',
    hasUrlParams: true,
    params: [
      { key: 'targetDate', label: '목표 날짜',              format: 'YYYY-MM-DD', required: true  },
      { key: 'baseDate',   label: '기준일 (기본: 오늘)',    format: 'YYYY-MM-DD', required: false },
      { key: 'label',      label: '항목 이름 (예: 크리스마스)', format: '문자열',  required: false },
    ],
    example: '2026-12-25 2026-04-13 크리스마스',
  },
  {
    id:       'date-diff',
    name:     '날짜 차이 계산기',
    category: '날짜·시간',
    url:      '/cal/date-diff/',
    hasUrlParams: true,
    params: [
      { key: 'start',      label: '시작일',               format: 'YYYY-MM-DD', required: true  },
      { key: 'end',        label: '종료일',               format: 'YYYY-MM-DD', required: true  },
      { key: 'includeEnd', label: '종료일 포함 (0 또는 1)', format: '0|1',       required: false },
    ],
    example: '2026-01-01 2026-12-31 1',
  },
  {
    id:       'date-add',
    name:     '날짜 더하기/빼기',
    category: '날짜·시간',
    url:      '/cal/date-add/',
    hasUrlParams: true,
    params: [
      { key: 'base',         label: '기준 날짜',           format: 'YYYY-MM-DD', required: true  },
      { key: 'mode',         label: '모드 (+ 또는 -)',     format: '+|-',         required: false },
      { key: 'years',        label: '년',                  format: '숫자',       required: false },
      { key: 'months',       label: '월',                  format: '숫자',       required: false },
      { key: 'days',         label: '일',                  format: '숫자',       required: false },
      { key: 'includeToday', label: '오늘 포함 (0 또는 1)', format: '0|1',       required: false },
    ],
    example: '2026-01-01 + 0 6 0 0',
  },
  {
    id:       'business-days',
    name:     '영업일 계산기',
    category: '날짜·시간',
    url:      '/cal/business-days/',
    hasUrlParams: true,
    params: [
      { key: 'start', label: '시작일',                 format: 'YYYY-MM-DD', required: true  },
      { key: 'end',   label: '종료일',                 format: 'YYYY-MM-DD', required: true  },
      { key: 'exHol', label: '공휴일 제외 (0 또는 1)', format: '0|1',        required: false },
    ],
    example: '2026-04-01 2026-04-30 1',
  },
  {
    id:       'age',
    name:     '만 나이 계산기',
    category: '날짜·시간',
    url:      '/cal/age/',
    hasUrlParams: true,
    params: [
      { key: 'birth', label: '생년월일',          format: 'YYYY-MM-DD', required: true  },
      { key: 'base',  label: '기준일 (기본: 오늘)', format: 'YYYY-MM-DD', required: false },
    ],
    example: '1990-05-15 2026-04-13',
  },
  {
    id:       'anniversary',
    name:     '기념일 계산기',
    category: '날짜·시간',
    url:      '/cal/anniversary/',
    hasUrlParams: true,
    params: [
      { key: 'start', label: '시작일 (기념일 기준일)', format: 'YYYY-MM-DD', required: true },
    ],
    example: '2025-12-25',
  },
  {
    id:       'lunar',
    name:     '양력 음력 변환기',
    category: '날짜·시간',
    url:      '/cal/lunar/',
    hasUrlParams: true,
    params: [
      { key: 'tab',       label: '변환 방향 (solar=양력→음력, lunar=음력→양력)', format: 'solar|lunar', required: true  },
      { key: 'solarYear',  label: '[양력→음력] 양력 년도',   format: '숫자', required: false },
      { key: 'solarMonth', label: '[양력→음력] 양력 월',     format: '숫자', required: false },
      { key: 'solarDay',   label: '[양력→음력] 양력 일',     format: '숫자', required: false },
      { key: 'lunarYear',  label: '[음력→양력] 음력 년도',   format: '숫자', required: false },
      { key: 'lunarMonth', label: '[음력→양력] 음력 월',     format: '숫자', required: false },
      { key: 'lunarDay',   label: '[음력→양력] 음력 일',     format: '숫자', required: false },
      { key: 'isIntercalation', label: '[음력→양력] 윤달 여부 (0 또는 1)', format: '0|1', required: false },
    ],
    example: 'solar 2026 4 13',
  },

  // ── 건강·신체 ───────────────────────────────────────────────────────────
  {
    id:       'weight',
    name:     '적정 체중 계산기',
    category: '건강·신체',
    url:      '/cal/weight/',
    hasUrlParams: true,
    params: [
      { key: 'height', label: '키 (cm)',    format: '숫자',  required: true },
      { key: 'weight', label: '체중 (kg)',  format: '숫자',  required: true },
      { key: 'gender', label: '성별 (M/F)', format: 'M|F',  required: true },
    ],
    example: '170 65 M',
  },
  {
    id:       'calorie',
    name:     '기초대사량 계산기',
    category: '건강·신체',
    url:      '/cal/calorie/',
    hasUrlParams: true,
    params: [
      { key: 'gender',   label: '성별 (M/F)',                                                        format: 'M|F',   required: true },
      { key: 'age',      label: '나이',                                                              format: '숫자',  required: true },
      { key: 'height',   label: '키 (cm)',                                                            format: '숫자',  required: true },
      { key: 'weight',   label: '체중 (kg)',                                                          format: '숫자',  required: true },
      { key: 'activity', label: '활동 수준 (sedentary/lightly/moderately/very/extra)', format: '문자열', required: true },
    ],
    example: 'M 30 175 70 moderately',
  },
  {
    id:       'period',
    name:     '생리주기 계산기',
    category: '건강·신체',
    url:      '/cal/period/',
    hasUrlParams: true,
    params: [
      { key: 'lastDate',  label: '마지막 생리 시작일', format: 'YYYY-MM-DD', required: true  },
      { key: 'cycleLen',  label: '주기 (일, 기본 28)', format: '숫자',       required: false },
      { key: 'periodLen', label: '생리 기간 (일, 기본 5)', format: '숫자',   required: false },
    ],
    example: '2026-03-20 28 5',
  },

  // ── 금융·급여 ───────────────────────────────────────────────────────────
  {
    id:       'salary',
    name:     '월급 실수령액 계산기',
    category: '금융·급여',
    url:      '/cal/salary/',
    hasUrlParams: true,
    params: [
      { key: 'gross',      label: '월 세전 급여 (원)',   format: '숫자', required: true  },
      { key: 'dependents', label: '부양가족 수 (1~6)',   format: '숫자', required: false },
    ],
    example: '3000000 1',
  },
  {
    id:       'severance',
    name:     '퇴직금 계산기',
    category: '금융·급여',
    url:      '/cal/severance/',
    hasUrlParams: true,
    params: [
      { key: 'startDate',   label: '입사일',              format: 'YYYY-MM-DD', required: true  },
      { key: 'endDate',     label: '퇴직일',              format: 'YYYY-MM-DD', required: true  },
      { key: 'monthlyWage', label: '월 급여 (원)',         format: '숫자',       required: true  },
      { key: 'annualBonus', label: '연간 상여금 (원)',     format: '숫자',       required: false },
      { key: 'annualLeave', label: '미사용 연차 일수',    format: '숫자',       required: false },
    ],
    example: '2020-01-01 2026-04-13 3000000',
  },
  {
    id:       'unemployment',
    name:     '실업급여 계산기',
    category: '금융·급여',
    url:      '/cal/unemployment/',
    hasUrlParams: true,
    params: [
      { key: 'exitDate',      label: '퇴직일',              format: 'YYYY-MM-DD', required: true  },
      { key: 'age',           label: '나이',                format: '숫자',       required: true  },
      { key: 'insuredPeriod', label: '고용보험 가입기간 (개월)', format: '숫자',   required: true  },
      { key: 'monthlyWage',   label: '월 급여 (원)',         format: '숫자',       required: true  },
      { key: 'hoursPerDay',   label: '하루 근무 시간',      format: '숫자',       required: false },
      { key: 'isDisabled',    label: '장애인 여부 (0 또는 1)', format: '0|1',     required: false },
    ],
    example: '2026-04-13 35 24 3000000 8 0',
  },
  {
    id:       'hourly',
    name:     '시급 계산기',
    category: '금융·급여',
    url:      '/cal/hourly/',
    hasUrlParams: true,
    params: [
      { key: 'hourlyWage',  label: '시급 (원)',     format: '숫자', required: true  },
      { key: 'hoursPerDay', label: '하루 근무 시간', format: '숫자', required: false },
      { key: 'daysPerWeek', label: '주 근무 일수',  format: '숫자', required: false },
    ],
    example: '10030 8 5',
  },
  {
    id:       'loan',
    name:     '대출 이자 계산기',
    category: '금융·급여',
    url:      '/cal/loan/',
    hasUrlParams: true,
    params: [
      { key: 'principal', label: '대출 금액 (원)',                                            format: '숫자',  required: true  },
      { key: 'rate',      label: '연 이율 (%)',                                               format: '숫자',  required: true  },
      { key: 'years',     label: '대출 기간 (개월)',                                          format: '숫자',  required: true  },
      { key: 'method',    label: '상환 방식 (equal-payment/equal-principal/bullet)', format: '문자열', required: true  },
    ],
    example: '100000000 4.5 360 equal-payment',
  },
  {
    id:       'vat',
    name:     '부가세 계산기',
    category: '금융·급여',
    url:      '/cal/vat/',
    hasUrlParams: true,
    params: [
      { key: 'mode',   label: '계산 방향 (add=공급가→합계, reverse=합계→공급가)', format: 'add|reverse', required: true },
      { key: 'amount', label: '금액 (원)',                                         format: '숫자',        required: true },
    ],
    example: 'add 1000000',
  },
  {
    id:       'income-tax',
    name:     '종합소득세 계산기',
    category: '금융·급여',
    url:      '/cal/income-tax/',
    hasUrlParams: true,
    params: [
      { key: 'incomeType',     label: '소득 유형 (0=근로, 1=사업, 2=프리랜서)', format: '0|1|2', required: true  },
      { key: 'grossIncome',    label: '총 소득 (원)',                            format: '숫자',  required: true  },
      { key: 'basicCount',     label: '기본 공제 인원 (기본 1)',                 format: '숫자',  required: false },
      { key: 'elderCount',     label: '경로우대 인원',                          format: '숫자',  required: false },
      { key: 'disabledCount',  label: '장애인 인원',                            format: '숫자',  required: false },
      { key: 'pension',        label: '연금보험료 공제 (원)',                    format: '숫자',  required: false },
      { key: 'annuity',        label: '연금저축 (원)',                           format: '숫자',  required: false },
      { key: 'childCount',     label: '자녀 수',                                format: '숫자',  required: false },
      { key: 'otherDeduction', label: '기타 소득공제 (원)',                      format: '숫자',  required: false },
    ],
    example: '0 50000000 1',
  },

  // ── 운세·라이프 ──────────────────────────────────────────────────────────
  {
    id:       'zodiac',
    name:     '띠/별자리 계산기',
    category: '운세·라이프',
    url:      '/cal/zodiac/',
    hasUrlParams: true,
    params: [
      { key: 'birth', label: '생년월일', format: 'YYYY-MM-DD', required: true },
    ],
    example: '1990-05-15',
  },
  {
    id:       'mbti',
    name:     'MBTI 궁합 계산기',
    category: '운세·라이프',
    url:      '/cal/mbti/',
    hasUrlParams: true,
    params: [
      { key: 'typeA', label: '나의 MBTI (예: INFJ)',     format: '4글자', required: true },
      { key: 'typeB', label: '상대방 MBTI (예: ENFP)',   format: '4글자', required: true },
    ],
    example: 'INFJ ENFP',
  },
  {
    id:       'lotto',
    name:     '로또 추첨기',
    category: '운세·라이프',
    url:      '/cal/lotto/',
    hasUrlParams: false,
    note:     '로또 추첨기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },

  // ── 유틸리티 ─────────────────────────────────────────────────────────────
  {
    id:       'char-count',
    name:     '글자수 세기',
    category: '유틸리티',
    url:      '/cal/char-count/',
    hasUrlParams: true,
    params: [
      { key: 'text', label: '분석할 텍스트', format: '문자열', required: true },
    ],
    example: '안녕하세요 세렌킷 글자수 세기 테스트입니다',
  },
  {
    id:       'pyeong',
    name:     '평수 계산기',
    category: '유틸리티',
    url:      '/cal/pyeong/',
    hasUrlParams: true,
    params: [
      { key: 'active', label: '변환 방향 (pyeong=평→m², sqm=m²→평)', format: 'pyeong|sqm', required: true  },
      { key: 'pyeong', label: '[평→m²] 평수',                         format: '숫자',       required: false },
      { key: 'sqm',    label: '[m²→평] 제곱미터',                     format: '숫자',       required: false },
    ],
    example: 'pyeong 25',
  },
  {
    id:       'unit',
    name:     '단위 변환기',
    category: '유틸리티',
    url:      '/cal/unit/',
    hasUrlParams: true,
    params: [
      { key: 'catKey',   label: '카테고리 (length/weight/temperature/area/volume/speed/data)', format: '문자열', required: true },
      { key: 'fromUnit', label: '변환 원본 단위 (예: km, kg, celsius)',                       format: '문자열', required: true },
      { key: 'inputVal', label: '변환할 값',                                                   format: '숫자',   required: true },
    ],
    example: 'length km 10',
  },

  // ── 색상 도구 ────────────────────────────────────────────────────────────
  {
    id:       'color-picker',
    name:     '색상 피커',
    category: '색상 도구',
    url:      '/color/color-picker/',
    hasUrlParams: false,
    note:     '색상 피커는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'color-converter',
    name:     '색상 포맷 변환기',
    category: '색상 도구',
    url:      '/color/color-converter/',
    hasUrlParams: false,
    note:     '색상 변환기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'color-extractor',
    name:     '이미지 색상 추출',
    category: '색상 도구',
    url:      '/color/color-extractor/',
    hasUrlParams: false,
    note:     '색상 추출기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'color-names',
    name:     '색상 이름 찾기',
    category: '색상 도구',
    url:      '/color/color-names/',
    hasUrlParams: false,
    note:     '색상 이름 찾기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'contrast-checker',
    name:     '명도 대비 검사기',
    category: '색상 도구',
    url:      '/color/contrast-checker/',
    hasUrlParams: false,
    note:     '명도 대비 검사기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'gradient-generator',
    name:     '그라디언트 생성기',
    category: '색상 도구',
    url:      '/color/gradient-generator/',
    hasUrlParams: false,
    note:     '그라디언트 생성기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'palette-generator',
    name:     '색상 팔레트 생성기',
    category: '색상 도구',
    url:      '/color/palette-generator/',
    hasUrlParams: false,
    note:     '팔레트 생성기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'tailwind-palette',
    name:     'Tailwind 색상표',
    category: '색상 도구',
    url:      '/color/tailwind-palette/',
    hasUrlParams: false,
    note:     'Tailwind 색상표는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },

  // ── 개발자 도구 ──────────────────────────────────────────────────────────
  {
    id:       'timestamp',
    name:     '타임스탬프 변환기',
    category: '개발자 도구',
    url:      '/dev/timestamp/',
    hasUrlParams: false,
    note:     '타임스탬프 변환기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'base64',
    name:     'Base64 인코더/디코더',
    category: '개발자 도구',
    url:      '/dev/base64/',
    hasUrlParams: false,
    note:     'Base64 도구는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'url-encoder',
    name:     'URL 인코더/디코더',
    category: '개발자 도구',
    url:      '/dev/url-encoder/',
    hasUrlParams: false,
    note:     'URL 인코더는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'uuid',
    name:     'UUID 생성기',
    category: '개발자 도구',
    url:      '/dev/uuid/',
    hasUrlParams: false,
    note:     'UUID 생성기는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
  {
    id:       'regex-tester',
    name:     '정규식 테스터',
    category: '개발자 도구',
    url:      '/dev/regex-tester/',
    hasUrlParams: false,
    note:     '정규식 테스터는 URL 파라미터를 지원하지 않아 기본 양식만 캡처합니다.',
  },
];

// ─── readline 유틸 ───────────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

// ─── 광고 숨김 스크립트 ──────────────────────────────────────────────────────
const HIDE_ADS_SCRIPT = `
  // 애드센스 ins 요소 및 부모 컨테이너 숨기기
  document.querySelectorAll('ins.adsbygoogle').forEach(el => {
    let p = el.parentElement;
    while (p) {
      const style = p.getAttribute('style') || '';
      if (style.includes('min-height')) { p.style.display = 'none'; break; }
      p = p.parentElement;
    }
    el.style.display = 'none';
  });
  // 결과 공유 버튼 영역 숨기기
  document.querySelectorAll('[data-share-ignore]').forEach(el => {
    el.style.display = 'none';
  });
  // 사이드바 광고 컨테이너 숨기기 (xl:flex 컨테이너)
  document.querySelectorAll('.xl\\\\:flex').forEach(el => {
    if (el.querySelector('ins.adsbygoogle')) el.style.display = 'none';
  });
`;

// ─── 파라미터 파싱 ──────────────────────────────────────────────────────────
/**
 * 사용자 입력 문자열을 파라미터 객체로 변환
 * 구분자: 띄어쓰기 또는 슬래시(/)
 */
function parseParamInput(tool, inputStr) {
  if (!tool.params || tool.params.length === 0) return {};

  // 슬래시 구분 또는 공백 구분
  const rawValues = inputStr.includes('/')
    ? inputStr.split('/').map(s => s.trim()).filter(Boolean)
    : inputStr.trim().split(/\s+/);

  const result = {};
  tool.params.forEach((param, i) => {
    if (i < rawValues.length && rawValues[i] !== '' && rawValues[i] !== '-') {
      result[param.key] = rawValues[i];
    }
  });
  return result;
}

// ─── URL 빌더 ────────────────────────────────────────────────────────────────
function buildUrl(baseUrl, toolUrl, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  });
  const qs = sp.toString();
  return `${baseUrl}${toolUrl}${qs ? '?' + qs : ''}`;
}

// ─── 출력 경로 파일명 생성 ───────────────────────────────────────────────────
function makeFilenames(tool) {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const base = `${tool.id}_${ts}`;
  return {
    form:   path.join(config.outputPath, `${base}_form.png`),
    result: path.join(config.outputPath, `${base}_result.png`),
  };
}

// ─── Puppeteer 캡처 ──────────────────────────────────────────────────────────
async function capturePage(page, url, outputPath, label) {
  console.log(`  → ${label} 로딩 중...`);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

  // 광고 숨기기
  await page.evaluate(HIDE_ADS_SCRIPT);

  // 콘텐츠 영역 선택 (main 엘리먼트)
  const mainEl = await page.$('main');
  if (!mainEl) {
    console.warn(`  [경고] main 요소를 찾을 수 없습니다. 전체 페이지로 대체합니다.`);
    await page.screenshot({ path: outputPath, fullPage: false });
  } else {
    await mainEl.screenshot({ path: outputPath });
  }
  console.log(`  ✓ 저장: ${outputPath}`);
}

// ─── 도구 선택 메뉴 출력 ─────────────────────────────────────────────────────
function printMenu() {
  console.log('\n' + '═'.repeat(60));
  console.log('  serenkit 캡처 도구');
  console.log('  설정 파일: config.json | 출력 경로: ' + config.outputPath);
  console.log('═'.repeat(60));

  let currentCategory = '';
  TOOLS.forEach((tool, i) => {
    if (tool.category !== currentCategory) {
      currentCategory = tool.category;
      console.log(`\n  ┌─ ${currentCategory} ${'─'.repeat(Math.max(0, 30 - currentCategory.length))}`);
    }
    const idx     = String(i + 1).padStart(2);
    const urlPad  = tool.url.padEnd(28);
    const urlMark = tool.hasUrlParams ? '●' : '○';
    console.log(`  │ ${idx}. ${urlMark} ${urlPad} ${tool.name}`);
  });

  console.log('\n  ● URL 파라미터 지원  ○ 기본 양식만 캡처');
  console.log('─'.repeat(60));
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main() {
  printMenu();

  // 도구 선택
  let tool;
  while (!tool) {
    const input = (await ask('\n번호 또는 URL을 입력하세요 (예: 1 또는 /cal/dday/): ')).trim();
    if (!input) continue;

    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= TOOLS.length) {
      tool = TOOLS[num - 1];
    } else {
      tool = TOOLS.find(t => t.url === input || t.id === input);
    }

    if (!tool) console.log('  [오류] 유효하지 않은 입력입니다. 다시 입력해주세요.');
  }

  console.log(`\n선택: [${tool.category}] ${tool.name} (${tool.url})`);

  // 파라미터 안내 및 입력
  let paramValues = {};

  if (!tool.hasUrlParams) {
    console.log(`\n  ℹ  ${tool.note}`);
  } else {
    console.log('\n필요한 파라미터:');
    tool.params.forEach((p, i) => {
      const req = p.required ? '(필수)' : '(선택)';
      console.log(`  ${i + 1}. ${p.key.padEnd(18)} ${req.padEnd(6)} 형식: ${p.format}`);
      console.log(`     → ${p.label}`);
    });
    console.log(`\n  예시: ${tool.example}`);
    console.log('  구분자: 띄어쓰기 또는 슬래시(/) 사용 가능');
    console.log('  선택 파라미터 건너뛰기: - 입력\n');

    let paramInput = '';
    while (!paramInput.trim()) {
      paramInput = await ask('파라미터 값을 입력하세요: ');
    }
    paramValues = parseParamInput(tool, paramInput);

    console.log('\n입력된 파라미터:');
    Object.entries(paramValues).forEach(([k, v]) => console.log(`  ${k} = ${v}`));
  }

  // 출력 경로 확인
  if (!fs.existsSync(config.outputPath)) {
    fs.mkdirSync(config.outputPath, { recursive: true });
    console.log(`\n출력 폴더 생성: ${config.outputPath}`);
  }

  const filenames = makeFilenames(tool);
  const formUrl   = `${config.baseUrl}${tool.url}`;
  const resultUrl = buildUrl(config.baseUrl, tool.url, paramValues);

  console.log('\n캡처 시작...');
  console.log(`  기본 양식 URL : ${formUrl}`);
  if (tool.hasUrlParams) {
    console.log(`  결과 페이지 URL: ${resultUrl}`);
  }

  // Puppeteer 실행
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width:             config.viewportWidth,
      height:            config.viewportHeight,
      deviceScaleFactor: config.deviceScaleFactor,
    });

    // 1) 기본 양식 캡처
    await capturePage(page, formUrl, filenames.form, '기본 양식');

    // 2) 결과 페이지 캡처 (URL 파라미터가 있는 도구만)
    if (tool.hasUrlParams && Object.keys(paramValues).length > 0) {
      // 결과가 렌더링될 시간을 추가로 대기
      await capturePage(page, resultUrl, filenames.result, '결과 페이지');
    } else if (tool.hasUrlParams) {
      console.log('  [스킵] 파라미터가 없어 결과 페이지 캡처를 건너뜁니다.');
    }

    console.log('\n✅ 완료!');
    console.log(`  기본 양식: ${filenames.form}`);
    if (tool.hasUrlParams && Object.keys(paramValues).length > 0) {
      console.log(`  결과 화면: ${filenames.result}`);
    }

  } catch (err) {
    console.error('\n❌ 에러 발생:', err.message);
  } finally {
    await browser.close();
    rl.close();
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  rl.close();
  process.exit(1);
});
