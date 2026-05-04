// 1차년도 2025년 이후 공제액 계산
function calcTaxCredit2025(currentStats, prevStats, companyType, region, year, year1) {
  const isMetro = region === 'Y';
  const credits = TAX_CREDITS.post2025;

  const getNthYearCredit = (type, nth) => {
    if (companyType === 'small') {
      const loc = isMetro ? credits.small.metro : credits.small.nonMetro;
      return loc[type][nth] || 0;
    }
    if (companyType === 'medium') return credits.medium[type][nth] || 0;
    return credits.large[type][nth] || 0;
  };

  // 몇 차년도인지
  const nthYear = year - year1; // 0=1차, 1=2차, 2=3차

  const prev = prevStats || { total: 0, youth: 0, nonYouth: 0 };

  const youthIncrease    = Math.max(0, round2(currentStats.youth    - (prev.youth    || 0)));
  const nonYouthIncrease = Math.max(0, round2(currentStats.nonYouth - (prev.nonYouth || 0)));
  const totalIncrease    = Math.max(0, round2(currentStats.total    - (prev.total    || 0)));

  const youthCapped    = Math.min(youthIncrease, totalIncrease);
  const nonYouthCapped = Math.max(0, round2(totalIncrease - youthCapped));

  const youthUnit    = getNthYearCredit('youth', nthYear);
  const nonYouthUnit = getNthYearCredit('nonYouth', nthYear);

  const youthCredit    = round2(youthCapped    * youthUnit);
  const nonYouthCredit = round2(nonYouthCapped * nonYouthUnit);
  const baseCredit     = round2(youthCredit + nonYouthCredit);

  // 정규직 전환 / 육아휴직 (중소·중견만)
  let regularCredit = 0, parentalCredit = 0;
  if (companyType !== 'large') {
    const rUnit = TAX_CREDITS.regularConvert[companyType] || 0;
    const pUnit = TAX_CREDITS.parentalLeave[companyType]  || 0;
    regularCredit = round2((currentStats.regularConvertCount || 0) * rUnit);
    parentalCredit = round2((currentStats.parentalLeaveCount  || 0) * pUnit);
  }

  const totalCredit = round2(baseCredit + regularCredit + parentalCredit);

  return {
    nthYear: nthYear + 1,
    youthIncrease: youthCapped,
    nonYouthIncrease: nonYouthCapped,
    totalIncrease,
    youthUnit,
    nonYouthUnit,
    youthCredit,
    nonYouthCredit,
    baseCredit,
    regularCredit,
    parentalCredit,
    totalCredit,
    prev
  };
}
