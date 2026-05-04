// K: 해당년도 시작 근로월 (1~12). null = 해당년도에 근무 안함
function getStartMonth(hireDateStr, year) {
  const d = parseDate(hireDateStr);
  if (!d) return 1; // 입사일 불명: 1월로 가정
  if (d.getFullYear() < year) return 1;
  if (d.getFullYear() > year) return null;
  return d.getMonth() + 1;
}

// L: 해당년도 종료 근로월 (1~12). null = 해당년도 이전 퇴사
function getEndMonth(resignDateStr, year) {
  if (!resignDateStr || resignDateStr === '') return 12;
  const d = parseDate(resignDateStr);
  if (!d) return 12;
  if (d.getFullYear() > year) return 12;
  if (d.getFullYear() < year) return null; // 이미 퇴사
  // 동일 연도: 말일 기준
  if (isEndOfMonth(d)) return d.getMonth() + 1;
  // 말일 아님: 해당 월 미포함
  return d.getMonth(); // 0 = 1월의 전달 → 이 경우 1월 비말일 퇴사면 0
}

// 근무기간 계산 → { K, L, M }
function calcWorkPeriod(hireDateStr, resignDateStr, year) {
  const K = getStartMonth(hireDateStr, year);
  const L = getEndMonth(resignDateStr, year);
  if (K === null || L === null || L < K || L < 1) {
    return { K: 0, L: 0, M: 0 };
  }
  return { K, L, M: L - K + 1 };
}

// 청년 여부 판단
// year1 < 2025: 당해년도 12/31 기준 만나이
// year1 >= 2025: 입사일(근로계약체결일) 기준 만나이
function isYouthWorker(birthDateStr, hireDateStr, year, year1, gender, militaryMonths, isDisabled, isElderly, isCareerBreak, isNK) {
  if (isDisabled || isElderly || isCareerBreak || isNK) return true;

  const birth = parseDate(birthDateStr);
  if (!birth) return false;

  let refDate;
  if (year1 < 2026) {
    // year1 2025 이하: 1차년도 12/31 기준 만나이
    refDate = new Date(year1, 11, 31);
  } else {
    // year1 2026 이상: 근로계약체결일(입사일) 기준 만나이
    refDate = parseDate(hireDateStr);
    if (!refDate) return false;
  }

  let age = calcManAge(birth, refDate);
  if (age === null) return false;

  // 군복무 차감 (남성만)
  if (gender === 'M' && militaryMonths > 0) {
    age = age - (militaryMonths / 12);
  }

  return age >= 15 && age <= 34;
}

// 1명의 상시근로자수 기여분 계산
// 반환: { K, L, M, contribution, youthContribution }
function calcEmployeeContribution(emp, year, year1) {
  if (emp.isExcluded) {
    return { K: 0, L: 0, M: 0, contribution: 0, youthContribution: 0 };
  }

  const { K, L, M } = calcWorkPeriod(emp.hireDateStr, emp.resignDateStr, year);
  if (M <= 0) {
    return { K, L, M: 0, contribution: 0, youthContribution: 0 };
  }

  const multiplier = emp.partTimeType === '0.5' ? 0.5
    : emp.partTimeType === '0.75' ? 0.75 : 1.0;

  let contribution = 0;

  if (year1 < 2026) {
    // year1 2025 이하: M/12 * multiplier, 소수점 2자리 절사 (1년 미만 근무자도 포함)
    contribution = roundDown2((M / 12) * multiplier);
  } else {
    // year1 2026 이상: 1년이상 근무자만 포함, 1년 기산월부터 카운트
    const hireDate = parseDate(emp.hireDateStr);
    const endDate = emp.resignDateStr ? parseDate(emp.resignDateStr) : new Date(year, 11, 31);
    if (!hireDate || !endDate) return { K, L, M: 0, contribution: 0, youthContribution: 0 };

    const totalMonths = (endDate.getFullYear() - hireDate.getFullYear()) * 12
      + (endDate.getMonth() - hireDate.getMonth())
      + (endDate.getDate() >= hireDate.getDate() ? 0 : -1);

    if (totalMonths < 12) return { K, L, M, contribution: 0, youthContribution: 0 };

    // 1년 기산월: 입사월 + 12개월 = 다음 해 같은 달
    const annYear  = hireDate.getFullYear() + 1;
    const annMonth = hireDate.getMonth(); // 0-based
    const K_eff = annYear < year ? 1 : (annYear === year ? annMonth + 1 : K);
    const M_eff = Math.max(0, L - K_eff + 1);

    contribution = roundDown2((M_eff / 12) * multiplier);

    const isYouthEff = isYouthWorker(
      emp.birthDateStr, emp.hireDateStr, year, year1,
      emp.gender, emp.militaryMonths || 0,
      emp.isDisabled, emp.isElderly, emp.isCareerBreak, emp.isNK
    );
    return { K: K_eff, L, M: M_eff, contribution, youthContribution: isYouthEff ? contribution : 0 };
  }

  // year1 기준으로 청년 여부 재계산 (emp.isYouth는 stream1 캐시 — 다른 year1엔 틀림)
  const isYouth = isYouthWorker(
    emp.birthDateStr, emp.hireDateStr, year, year1,
    emp.gender, emp.militaryMonths || 0,
    emp.isDisabled, emp.isElderly, emp.isCareerBreak, emp.isNK
  );

  const youthContribution = isYouth ? contribution : 0;

  return { K, L, M, contribution, youthContribution };
}

// 전체 직원 목록에서 상시근로자수 집계
function calcStats(employees, year, year1) {
  let total = 0, youth = 0, nonYouth = 0;
  let regularConvertCount = 0, parentalLeaveCount = 0;

  employees.forEach(emp => {
    const calc = calcEmployeeContribution(emp, year, year1);
    total += calc.contribution;
    youth += calc.youthContribution;
    nonYouth += calc.contribution - calc.youthContribution;
    if (!emp.isExcluded && emp.isRegularConvert) regularConvertCount++;
    if (!emp.isExcluded && emp.isParentalLeave) parentalLeaveCount++;
  });

  return {
    total: round2(total),
    youth: round2(youth),
    nonYouth: round2(nonYouth),
    regularConvertCount,
    parentalLeaveCount
  };
}
