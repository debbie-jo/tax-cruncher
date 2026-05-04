// ── 전체 공제 계산 엔진 (3개 스트림 동시 계산) ─────────────────────
//
// 경계 규정 (부칙):
//   year1 ≤ 2025: 종전 규정 — pre-2025 단가 + pre-2026 상시근로자 규칙 + 사후관리 有
//   year1 ≥ 2026: 신규정  — post-2025 단가 + 1년이상 조건 + 사후관리 폐지
//
// 스트림 구성:
//   stream1: year1=year  신규 1차 기본공제
//   stream2: year1=year-1 (year1 < 2026만 존재 — 사후관리)
//   stream3: year1=year-2 (year1 < 2026만 존재 — 사후관리, 중소 3차)
//
// ※ 스트림별로 year1에 맞는 규칙 적용: calcStats(employees, year, year1_of_stream)
function findLegacyRuleYear1(prevYears, year) {
  const years = prevYears || [];
  for (let y = year - 2; y <= year - 1; y++) {
    if (y >= 2026) continue;
    const cur = years.find(p => p.year === y);
    if (cur && (cur.total || cur.youth || cur.nonYouth)) {
      return y;
    }
  }
  return year;
}

function runEngine(state) {
  const { year, companyType, region, employees, prevYears } = state;
  if (!employees || employees.length === 0) return null;

  const py1 = (prevYears || []).find(p => p.year === year - 1) || null;  // Y-1
  const py2 = (prevYears || []).find(p => p.year === year - 2) || null;  // Y-2
  const ruleYear1 = findLegacyRuleYear1(prevYears, year);

  // ── 스트림1: 신규 1차 기본공제 (year1=year) ────────────────────────
  const currentStats = calcStats(employees, year, ruleYear1);
  let stream1;
  if (ruleYear1 >= 2026) {
    // year1 ≥ 2026: 신규정 — post-2025 단가, nthYear=0(1차)
    stream1 = calcTaxCredit2025(currentStats, py1, companyType, region, year, year);
  } else {
    // year1 ≤ 2025: 종전 규정 — pre-2025 단가
    stream1 = calcBasicCredit2024(currentStats, py1, companyType, region, year);
    stream1.youthUnit    = stream1.unitCredit?.youth    || 0;
    stream1.nonYouthUnit = stream1.unitCredit?.nonYouth || 0;
  }
  stream1.year1        = year;
  stream1.ruleYear1    = ruleYear1;
  stream1.prevTotal    = py1?.total    || 0;
  stream1.prevYouth    = py1?.youth    || 0;
  stream1.prevNonYouth = py1?.nonYouth || 0;

  // ── 스트림2: year1=year-1 (종전 규정, year1 < 2026만 존재) ─────────
  // year1 < 2026이므로 항상 pre-2025 carry 로직 (calcCarryCredit_2nd)
  let stream2 = null;
  const y1_s2 = year - 1;
  if (py1 && y1_s2 <= 2025) {
    // year1별 상시근로자 규칙으로 당해 상시근로자수 계산
    const cs2 = calcStats(employees, year, ruleYear1);
    stream2 = calcCarryCredit_2nd(prevYears, cs2, companyType, region, y1_s2);
    stream2.year1        = y1_s2;
    stream2.ruleYear1    = ruleYear1;
    stream2.currentStats = cs2;
  }

  // ── 스트림3: year1=year-2 (종전 규정, year1 < 2026만 존재) ─────────
  let stream3 = null;
  const y1_s3 = year - 2;
  if (py2 && y1_s3 < 2025) {
    const cs3 = calcStats(employees, year, ruleYear1);
    stream3 = calcCarryCredit_3rd(prevYears, cs3, companyType, region, y1_s3);
    stream3.year1        = y1_s3;
    stream3.ruleYear1    = ruleYear1;
    stream3.currentStats = cs3;
  }

  const totalCredit = round2(
    (stream1?.totalCredit || 0) +
    (stream2?.totalCredit || 0) +
    (stream3?.totalCredit || 0)
  );

  return {
    year, companyType, region,
    currentStats, prevYears: prevYears || [],
    stream1, stream2, stream3,
    totalCredit
  };
}
