// ── 단가 조회 ────────────────────────────────────────────────────────
function getUnitCredit2024(companyType, region) {
  const isMetro = region === 'Y';
  const c = TAX_CREDITS.pre2025;
  return companyType === 'small'
    ? (isMetro ? c.small.metro : c.small.nonMetro)
    : companyType === 'medium' ? c.medium : c.large;
}

// ── 특정 연도 기본공제 역산 ───────────────────────────────────────────
// useNonYouthOnly=true → ② 청년 감소 케이스: 전체 증가분을 청년외 단가로
function calcPrevBaseCredit(prevYears, targetYear, unitCredit, useNonYouthOnly) {
  const cur  = (prevYears || []).find(p => p.year === targetYear);
  const prev = (prevYears || []).find(p => p.year === targetYear - 1);
  if (!cur || !prev) return 0;

  const tI = Math.max(0, round2((cur.total || 0) - (prev.total || 0)));

  if (useNonYouthOnly) {
    // ② 청년 감소: 전체 증가분 × 청년외 단가
    return round2(tI * (unitCredit.nonYouth || 0));
  }

  const yI = Math.max(0, round2((cur.youth || 0) - (prev.youth || 0)));
  const yC = Math.min(yI, tI);
  const nC = Math.max(0, round2(tI - yC));
  return round2(yC * (unitCredit.youth || 0) + nC * (unitCredit.nonYouth || 0));
}

function didYouthDecreaseFromPrev(prevYears, targetYear) {
  const cur  = (prevYears || []).find(p => p.year === targetYear);
  const prev = (prevYears || []).find(p => p.year === targetYear - 1);
  if (!cur || !prev) return false;
  return (cur.youth || 0) < (prev.youth || 0);
}

// ── 스트림1: 당해연도 신규 1차 기본공제 (year1 < 2025) ───────────────
function calcBasicCredit2024(currentStats, prevStats, companyType, region, year) {
  const unitCredit = getUnitCredit2024(companyType, region);
  const prev = prevStats || { total: 0, youth: 0, nonYouth: 0 };

  const tI = Math.max(0, round2(currentStats.total    - (prev.total    || 0)));
  const yI = Math.max(0, round2(currentStats.youth    - (prev.youth    || 0)));
  const yC = Math.min(yI, tI);
  const nC = Math.max(0, round2(tI - yC));

  const youthCredit    = round2(yC * (unitCredit.youth    || 0));
  const nonYouthCredit = round2(nC * (unitCredit.nonYouth || 0));
  const baseCredit     = round2(youthCredit + nonYouthCredit);

  let regularCredit = 0, parentalCredit = 0;
  if (companyType !== 'large') {
    regularCredit  = round2((currentStats.regularConvertCount || 0) * (TAX_CREDITS.regularConvert[companyType] || 0));
    parentalCredit = round2((currentStats.parentalLeaveCount  || 0) * (TAX_CREDITS.parentalLeave[companyType]  || 0));
  }

  return {
    year1: year,
    prevTotal: prev.total, prevYouth: prev.youth, prevNonYouth: prev.nonYouth,
    youthIncrease: yC, nonYouthIncrease: nC, totalIncrease: tI,
    youthUnit: unitCredit.youth, nonYouthUnit: unitCredit.nonYouth,
    youthCredit, nonYouthCredit, baseCredit,
    regularCredit, parentalCredit,
    totalCredit: round2(baseCredit + regularCredit + parentalCredit),
    unitCredit
  };
}

// ── 추징세액 계산 헬퍼 (Case A / B / C) ────────────────────────────
// year1TotalCredit: 1차년도 공제액 한도 (추징 상한값, null이면 한도 미적용)
function calcClawbackAmount(year1Total, year1Youth, checkTotal, checkYouth, unitCredit, year1TotalCredit) {
  const totalDec = round2(Math.max(0, year1Total - checkTotal));
  const youthRaw = round2(Math.max(0, year1Youth - checkYouth));
  const youthDec = youthRaw;  // 상한 제거

  if (totalDec > 0) {
    if (youthDec >= totalDec) {
      // Case A: 청년감소 ≥ 전체감소
      // 공식: (청년감소 - 전체감소) × (청년단가 - 청년외단가) + 전체감소 × 청년단가
      let clawback = round2((youthDec - totalDec) * (unitCredit.youth - unitCredit.nonYouth) + totalDec * unitCredit.youth);
      // 공제액 한도 적용
      clawback = year1TotalCredit != null ? Math.min(clawback, year1TotalCredit) : clawback;
      return {
        clawback, caseType: 'A', youthDec, totalDec, nYouthDec: 0
      };
    } else {
      // Case B: 청년감소 < 전체감소
      // 공식: 청년감소 × 청년단가 + 청년외감소 × 청년외단가
      const nYouthDec = round2(totalDec - youthDec);
      let clawback = round2(youthDec * unitCredit.youth + nYouthDec * unitCredit.nonYouth);
      // 공제액 한도 적용
      clawback = year1TotalCredit != null ? Math.min(clawback, year1TotalCredit) : clawback;
      return {
        clawback, caseType: 'B', youthDec, totalDec, nYouthDec
      };
    }
  } else if (youthDec > 0) {
    // Case C: 전체 유지, 청년 감소
    // 공식: 청년감소 × (청년단가 - 청년외단가)
    let clawback = round2(youthDec * (unitCredit.youth - unitCredit.nonYouth));
    // 공제액 한도 적용
    clawback = year1TotalCredit != null ? Math.min(clawback, year1TotalCredit) : clawback;
    return {
      clawback, caseType: 'C', youthDec, totalDec: 0, nYouthDec: 0
    };
  }
  return { clawback: 0, caseType: null, youthDec: 0, totalDec: 0, nYouthDec: 0 };
}

// ── 스트림2: 2차 추가공제 — (year-1)년 스트림 ───────────────────────
// ① 배제: 당해 전체 < year1 전체
// ② 부분배제: 당해 청년 < year1 청년 → 전체 증가분 × 청년외 단가
function calcCarryCredit_2nd(prevYears, currentStats, companyType, region, year1) {
  const unitCredit = getUnitCredit2024(companyType, region);
  const py1     = (prevYears || []).find(p => p.year === year1)     || { total: 0, youth: 0 };
  const py1prev = (prevYears || []).find(p => p.year === year1 - 1) || null;
  const year1Total = py1.total || 0;
  const year1Youth = py1.youth || 0;

  // year1 1차 공제액 계산 (추징 상한으로 사용)
  const year1Stats = { total: year1Total, youth: year1Youth, regularConvertCount: 0, parentalLeaveCount: 0 };
  const year0Stats = py1prev ? { total: py1prev.total || 0, youth: py1prev.youth || 0 } : { total: 0, youth: 0 };
  const year1BasicResult = calcBasicCredit2024(year1Stats, year0Stats, companyType, region, year1);
  const year1TotalCredit = year1BasicResult.totalCredit;

  const isMaintained    = currentStats.total >= year1Total;         // ① 전체 유지
  const firstYearYouthDecreased = didYouthDecreaseFromPrev(prevYears, year1);
  const currentYouthDecreased = currentStats.youth < year1Youth;
  const isYouthDecreased = firstYearYouthDecreased || currentYouthDecreased; // ② 청년 감소

  const carryCredit = isMaintained
    ? calcPrevBaseCredit(prevYears, year1, unitCredit, isYouthDecreased)
    : 0;

  // 추징세액 계산 (Case A/B/C) - year1TotalCredit을 상한으로 전달
  const cbd = calcClawbackAmount(year1Total, year1Youth, currentStats.total, currentStats.youth, unitCredit, year1TotalCredit);

  return {
    year1,
    isMaintained,
    isYouthDecreased,
    youthDecreaseReason: firstYearYouthDecreased ? 'firstYear' : (currentYouthDecreased ? 'currentYear' : ''),
    year1Total, year1Youth,
    currentTotal: currentStats.total, currentYouth: currentStats.youth,
    carryCredit,
    totalCredit: carryCredit,
    clawback:          cbd.clawback,
    clawbackCase:      cbd.caseType,
    clawbackYouthDec:  cbd.youthDec,
    clawbackTotalDec:  cbd.totalDec,
    clawbackNYouthDec: cbd.nYouthDec
  };
}

// ── 스트림3: 3차 추가공제 — (year-2)년 스트림 (pre-2025 only) ───────
// year1 carry: ①영구배제(y2>=y1 AND cur>=y1), ②청년감소(cur youth < y1 youth)
// ※ year2CarryCredit 제거 — stream2가 동일 금액 계산하므로 중복
function calcCarryCredit_3rd(prevYears, currentStats, companyType, region, year1) {
  const unitCredit = getUnitCredit2024(companyType, region);
  const year2      = year1 + 1;
  const py1     = (prevYears || []).find(p => p.year === year1)     || { total: 0, youth: 0 };
  const py2     = (prevYears || []).find(p => p.year === year2)     || { total: 0, youth: 0 };
  const py1prev = (prevYears || []).find(p => p.year === year1 - 1) || null;

  const year1Total = py1.total || 0;
  const year1Youth = py1.youth || 0;
  const year2Total = py2.total || 0;
  const year2Youth = py2.youth || 0;

  // year1 1차 공제액 계산 (추징 상한으로 사용)
  const year1Stats = { total: year1Total, youth: year1Youth, regularConvertCount: 0, parentalLeaveCount: 0 };
  const year0Stats = py1prev ? { total: py1prev.total || 0, youth: py1prev.youth || 0 } : { total: 0, youth: 0 };
  const year1BasicResult = calcBasicCredit2024(year1Stats, year0Stats, companyType, region, year1);
  const year1TotalCredit = year1BasicResult.totalCredit;

  // ① 전체 유지 (year1 기준, 중간년도 AND 당해 모두 충족)
  const y2_ok           = year2Total >= year1Total;
  const cur_ok          = currentStats.total >= year1Total;
  const isMaintained_y1 = y2_ok && cur_ok;

  // ② 청년 감소 (year1 기준)
  const firstYearYouthDecreased = didYouthDecreaseFromPrev(prevYears, year1);
  const year2YouthDecreased = year2Youth < year1Youth;
  const currentYouthDecreased = currentStats.youth < year1Youth;
  const isYouthDec_y1 = firstYearYouthDecreased || year2YouthDecreased || currentYouthDecreased;

  const year1CarryCredit = isMaintained_y1
    ? calcPrevBaseCredit(prevYears, year1, unitCredit, isYouthDec_y1)
    : 0;

  // 추징세액 계산 (2년이내: base × 공제횟수2 - 1년이내 기납부 추징) - year1TotalCredit을 상한으로 전달
  const baseCbd  = calcClawbackAmount(year1Total, year1Youth, currentStats.total, currentStats.youth, unitCredit, year1TotalCredit);
  const priorCbd = calcClawbackAmount(year1Total, year1Youth, year2Total, year2Youth, unitCredit, year1TotalCredit);
  // 공제횟수 = 실제 공제받은 횟수
  // y2_ok=true: 1차+2차 모두 받음 → ×2
  // y2_ok=false: 2차 배제, 1차만 받음 → ×1
  const multiplier = y2_ok ? 2 : 1;
  const priorClawback = priorCbd.clawback;
  const clawback3 = baseCbd.clawback > 0
    ? Math.max(0, round2(baseCbd.clawback * multiplier - priorClawback))
    : 0;

  return {
    year1, year2,
    isMaintained_y1,
    isYouthDec_y1,
    youthDecreaseReason: firstYearYouthDecreased ? 'firstYear' : (year2YouthDecreased ? 'year2' : (currentYouthDecreased ? 'currentYear' : '')),
    year1Total, year1Youth,
    year2Total, year2Youth,
    currentTotal: currentStats.total, currentYouth: currentStats.youth,
    year1CarryCredit,
    totalCredit: year1CarryCredit,
    clawback:          clawback3,
    clawbackCase:      baseCbd.caseType,
    clawbackYouthDec:  baseCbd.youthDec,
    clawbackTotalDec:  baseCbd.totalDec,
    clawbackNYouthDec: baseCbd.nYouthDec,
    clawbackBase:      baseCbd.clawback,   // ×multiplier 전 기준값 (표시용)
    clawbackMultiplier: multiplier,
    priorClawback,
    priorClawbackCase: priorCbd.caseType
  };
}
