function renderTab2() {
  const result    = AppState.calcResult;
  const container = document.getElementById('tab2-content');

  if (!result) {
    container.innerHTML = '<div class="warn-box">Tab 1에서 명세서를 먼저 입력하세요.</div>';
    return;
  }

  const { year, companyType, region, currentStats, stream1, stream2, stream3, totalCredit, prevYears } = result;
  const typeLabel   = { small:'중소기업', medium:'중견기업', large:'대기업' }[companyType] || '';
  const regionLabel = region === 'Y' ? '수도권' : '비수도권';

  const won  = (v) => (!v && v !== 0) ? '-' : (v * 10000).toLocaleString() + '원';
  const wonZ = (v) => (v * 10000).toLocaleString() + '원';

  const badgeOk = '<span style="background:#2e7d32;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✓ 유지</span>';
  const badgeNg = '<span style="background:#c62828;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✗ 배제</span>';
  const badge2  = '<span style="background:#e65100;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">② 청년감소</span>';
  const mkBadge = (ok) => ok ? badgeOk : badgeNg;

  // ── 연도별 비교 테이블 ──────────────────────────────────────────────
  const yearRows = [];
  for (let y = year - 3; y <= year; y++) {
    const data  = y === year ? currentStats : ((prevYears || []).find(p => p.year === y) || {});
    const isCur = y === year;
    yearRows.push(`<tr${isCur ? ' style="background:#e3f2fd;font-weight:600"' : ''}>
      <td style="text-align:center">${y}년${isCur ? ' <span style="font-size:11px;color:#1565c0">(당해)</span>' : ''}</td>
      <td style="text-align:center;color:#2e7d32">${data.youth    ?? '-'}</td>
      <td style="text-align:center">${data.nonYouth ?? '-'}</td>
      <td style="text-align:center;font-weight:600">${data.total   ?? '-'}</td>
    </tr>`);
  }

  // ── 1차 기본공제 ─────────────────────────────────────────────────────
  const s1 = stream1 || {};
  const s1RuleYear1 = s1.ruleYear1 || year;
  const s1RuleLabel = s1RuleYear1 === year
    ? `${year}년`
    : `${year}년 / 규정기준=${s1RuleYear1}년`;
  const extraRows1 = [];
  if (companyType !== 'large') {
    const rUnit = TAX_CREDITS.regularConvert[companyType] || 0;
    const pUnit = TAX_CREDITS.parentalLeave[companyType]  || 0;
    extraRows1.push(`
      <tr>
        <td>정규직 전환 공제</td>
        <td style="text-align:center">${currentStats.regularConvertCount || 0}명</td>
        <td style="text-align:center">${won(rUnit)}</td>
        <td style="text-align:right;font-weight:600">${won(s1.regularCredit)}</td>
      </tr>
      <tr>
        <td>육아휴직 복귀 공제</td>
        <td style="text-align:center">${currentStats.parentalLeaveCount || 0}명</td>
        <td style="text-align:center">${won(pUnit)}</td>
        <td style="text-align:right;font-weight:600">${won(s1.parentalCredit)}</td>
      </tr>`);
  }

  const nthLabel1 = s1.isPost2025 ? ` (1차 단가 ${won(s1.youthUnit)}·${won(s1.nonYouthUnit)})` : '';
  const stream1Card = `
    <div class="result-card" style="border-left:4px solid #1565c0">
      <h3>💰 ${year}년 1차 기본공제
        <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">${s1RuleLabel}</span>
      </h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:#f9fbe7;border:1px solid #c5e1a5;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#558b2f;margin-bottom:6px">직전년도 (${year-1}년)</div>
          <div style="font-size:13px;color:#555">
            청년 <strong style="color:#2e7d32">${s1.prevYouth ?? 0}</strong> /
            청년외 <strong>${s1.prevNonYouth ?? 0}</strong> /
            합계 <strong>${s1.prevTotal ?? 0}</strong>
          </div>
        </div>
        <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#1565c0;margin-bottom:6px">당해연도 (${year}년)</div>
          <div style="font-size:13px;color:#555">
            청년 <strong style="color:#2e7d32">${currentStats.youth}</strong> /
            청년외 <strong>${currentStats.nonYouth}</strong> /
            합계 <strong>${currentStats.total}</strong>
          </div>
        </div>
        <div style="background:#fff3e0;border:1px solid #ffcc02;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#e65100;margin-bottom:6px">증가인원 (대비 직전년도)</div>
          <div style="font-size:15px">
            청년 <strong style="color:#2e7d32;font-size:18px">${s1.youthIncrease ?? 0}</strong>
            &nbsp;청년외 <strong style="font-size:18px">${s1.nonYouthIncrease ?? 0}</strong>
            &nbsp;합계 <strong style="color:#1565c0;font-size:18px">${s1.totalIncrease ?? 0}</strong>
          </div>
        </div>
      </div>
      <table class="result-table">
        <thead>
          <tr>
            <th>구분</th><th style="text-align:center">증가인원</th>
            <th style="text-align:center">1인당 공제액</th><th style="text-align:right">공제액</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>청년 등</strong></td>
            <td style="text-align:center">${s1.youthIncrease ?? 0}명</td>
            <td style="text-align:center;color:#1565c0">${won(s1.youthUnit)}</td>
            <td style="text-align:right;font-weight:700;color:#2e7d32">${won(s1.youthCredit)}</td>
          </tr>
          <tr>
            <td><strong>청년 외</strong></td>
            <td style="text-align:center">${s1.nonYouthIncrease ?? 0}명</td>
            <td style="text-align:center;color:#1565c0">${won(s1.nonYouthUnit)}</td>
            <td style="text-align:right;font-weight:700">${won(s1.nonYouthCredit)}</td>
          </tr>
          ${extraRows1.join('')}
          <tr style="background:#f5f5f5">
            <td colspan="3" style="text-align:right;padding-right:20px;font-weight:600">기본공제 소계</td>
            <td style="text-align:right;font-weight:700">${won(s1.totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;

  // ── 2차 추가공제 ────────────────────────────────────────────────────
  let stream2Card = '';
  if (stream2) {
    if (stream2.isPost2025) {
      // post-2025: year1 기준 증가분 × 2차 단가
      stream2Card = renderPost2025CarryCard(stream2, year, stream2.year1, '2차', '#ff8f00');
    } else {
      // pre-2025: 배제 조건 + carry 금액
      const s2  = stream2;
      const ok  = s2.isMaintained;
      const yd  = s2.isYouthDecreased;
      const cmpTotal = `당해(${s2.currentTotal}명) ${ok?'≥':'&lt;'} ${s2.year1}년(${s2.year1Total}명)`;
      const cmpYouth = yd
        ? (s2.youthDecreaseReason === 'firstYear'
          ? `${s2.year1 - 1}년 대비 ${s2.year1}년 청년 감소 → 청년외 단가 적용`
          : `당해 청년(${s2.currentYouth}명) &lt; ${s2.year1}년 청년(${s2.year1Youth}명) → 청년외 단가 적용`)
        : `당해 청년(${s2.currentYouth}명) ≥ ${s2.year1}년 청년(${s2.year1Youth}명)`;
      const rateNote = ok && yd
        ? `<span style="font-size:11px;color:#e65100">(증가분 전체 × 청년외 단가)</span>`
        : '';

      stream2Card = `
        <div class="result-card" style="border-left:4px solid #ff8f00">
          <h3>➕ ${s2.year1}년 공제 2차 추가공제
            <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">${s2.year1}년 기준 / 상시근로자 판정=${s2.ruleYear1 || s2.year1}년</span>
          </h3>
          <table class="result-table">
            <thead><tr>
              <th style="width:120px">구분</th>
              <th style="text-align:center">상태</th>
              <th style="text-align:center">비교</th>
              <th style="text-align:right;width:110px">추가공제액</th>
            </tr></thead>
            <tbody>
              <tr>
                <td>① 전체 유지</td>
                <td style="text-align:center">${mkBadge(ok)}</td>
                <td style="font-size:12px;color:#555">${cmpTotal}</td>
                <td rowspan="2" style="text-align:right;font-weight:700;color:${ok?'#2e7d32':'#aaa'};vertical-align:middle">
                  ${won(s2.carryCredit)} ${rateNote}
                </td>
              </tr>
              <tr>
                <td>② 청년 유지</td>
                <td style="text-align:center">${ok ? (yd ? badge2 : badgeOk) : '<span style="color:#aaa">-</span>'}</td>
                <td style="font-size:12px;color:${yd?'#e65100':'#555'}">${ok ? cmpYouth : '-'}</td>
              </tr>
              <tr style="background:#fff8e1">
                <td colspan="3" style="text-align:right;padding-right:20px;font-weight:700">추가공제 소계</td>
                <td style="text-align:right;font-weight:700;color:#e65100">${won(s2.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }
  }

  // ── 스트림3 ────────────────────────────────────────────────────────
  let stream3Card = '';
  if (stream3) {
    if (stream3.isPost2025) {
      stream3Card = renderPost2025CarryCard(stream3, year, stream3.year1, '3차', '#6a1b9a');
    } else {
      const s3  = stream3;
      const ok1 = s3.isMaintained_y1;
      const yd1 = s3.isYouthDec_y1;
      const y2_ok  = s3.year2Total >= s3.year1Total;
      const cr_ok  = s3.currentTotal >= s3.year1Total;
      const cmpY1total = `2차(${year-1}년,${s3.year2Total}명)${y2_ok?'≥':'&lt;'}1차(${s3.year1Total}명) ${y2_ok?'✓':'✗'} &nbsp;|&nbsp; 당해(${s3.currentTotal}명)${cr_ok?'≥':'&lt;'}1차(${s3.year1Total}명) ${cr_ok?'✓':'✗'}`;
      const cmpY1youth = yd1
        ? (s3.youthDecreaseReason === 'year2'
          ? `${s3.year2}년 청년이 ${s3.year1}년보다 감소 → 청년외 단가`
          : s3.youthDecreaseReason === 'firstYear'
            ? `${s3.year1 - 1}년 대비 ${s3.year1}년 청년 감소 → 청년외 단가`
            : `당해 청년(${s3.currentYouth}명) &lt; ${s3.year1}년 청년(${s3.year1Youth}명) → 청년외 단가`)
        : `당해 청년(${s3.currentYouth}명) ≥ ${s3.year1}년 청년(${s3.year1Youth}명)`;

      stream3Card = `
        <div class="result-card" style="border-left:4px solid #6a1b9a">
          <h3>➕ ${s3.year1}년 3차 추가공제
            <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">year1=${s3.year1}년 / 상시근로자 기준=${s3.ruleYear1 || s3.year1}년</span>
          </h3>
          <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:6px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#6a1b9a">
            ※ ① 영구배제: 감소 연도부터 이후 모든 연도 배제 &nbsp;|&nbsp; ② 청년 감소 시 전체 증가분 × 청년외 단가 적용
          </div>
          <table class="result-table">
            <thead><tr>
              <th style="width:120px">구분</th>
              <th style="text-align:center">상태</th>
              <th style="text-align:center">비교</th>
              <th style="text-align:right;width:110px">추가공제액</th>
            </tr></thead>
            <tbody>
              <tr>
                <td>① 전체 유지</td>
                <td style="text-align:center">${mkBadge(ok1)}</td>
                <td style="font-size:12px;color:#555">${cmpY1total}</td>
                <td rowspan="2" style="text-align:right;font-weight:700;color:${ok1?'#2e7d32':'#aaa'};vertical-align:middle">
                  ${won(s3.year1CarryCredit)}
                  ${ok1 && yd1 ? '<span style="font-size:11px;color:#e65100">(청년외 단가)</span>' : ''}
                </td>
              </tr>
              <tr>
                <td>② 청년 유지</td>
                <td style="text-align:center">${ok1 ? (yd1 ? badge2 : badgeOk) : '<span style="color:#aaa">-</span>'}</td>
                <td style="font-size:12px;color:${yd1?'#e65100':'#555'}">${ok1 ? cmpY1youth : '-'}</td>
              </tr>
              <tr style="background:#f3e5f5">
                <td colspan="3" style="text-align:right;padding-right:20px;font-weight:700">추가공제 소계</td>
                <td style="text-align:right;font-weight:700;color:#6a1b9a">${won(s3.totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    }
  }

  // ── 총 합계 ────────────────────────────────────────────────────────
  const s1ref = stream1 || {};
  const totalSummary = `
    <div class="result-card" style="background:#e3f2fd;border:2px solid #1565c0">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:13px;color:#666;margin-bottom:6px">
            기본공제 ${won(s1ref.totalCredit)}
            ${stream2 ? `+ 2차추가 ${won(stream2.totalCredit)}` : ''}
            ${stream3 ? `+ 3차추가 ${won(stream3.totalCredit)}` : ''}
          </div>
          <div style="font-size:22px;font-weight:700;color:#1565c0">총 세액공제액: ${wonZ(totalCredit)}</div>
        </div>
        <div style="text-align:right;font-size:13px;color:#555">${year}년 ${typeLabel} ${regionLabel}</div>
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:12px">
        <div style="background:#fff;border-radius:6px;padding:10px;text-align:center">
          <div style="color:#666;margin-bottom:4px">🔵 1차 기본공제</div>
          <div style="font-size:15px;font-weight:700;color:#1565c0">${wonZ(s1ref.totalCredit)}</div>
        </div>
        <div style="background:#fff;border-radius:6px;padding:10px;text-align:center">
          <div style="color:#666;margin-bottom:4px">🟡 2차 추가공제</div>
          <div style="font-size:15px;font-weight:700;color:#e65100">${stream2 ? wonZ(stream2.totalCredit) : '해당없음'}</div>
        </div>
        <div style="background:#fff;border-radius:6px;padding:10px;text-align:center">
          <div style="color:#666;margin-bottom:4px">🟣 3차 추가공제</div>
          <div style="font-size:15px;font-weight:700;color:#6a1b9a">${stream3 ? wonZ(stream3.totalCredit) : '해당없음'}</div>
        </div>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="result-card">
      <h3>📋 기본 정보</h3>
      <div class="summary-box" style="grid-template-columns:repeat(3,1fr)">
        <div class="summary-item"><div class="s-label">기업유형</div><div class="s-value" style="font-size:18px">${typeLabel}</div></div>
        <div class="summary-item"><div class="s-label">지역</div><div class="s-value" style="font-size:18px">${regionLabel}</div></div>
        <div class="summary-item"><div class="s-label">적용 연도</div><div class="s-value" style="font-size:18px">${year}년</div></div>
      </div>
    </div>

    <div class="result-card">
      <h3>📈 연도별 상시근로자수</h3>
      <table class="result-table">
        <thead><tr><th>연도</th><th>청년 등</th><th>청년 외</th><th>총 상시근로자수</th></tr></thead>
        <tbody>${yearRows.join('')}</tbody>
      </table>
    </div>

    ${stream1Card}
    ${stream2Card}
    ${stream3Card}
    ${totalSummary}`;
}

// ── post-2025 carry 카드 공통 렌더러 ───────────────────────────────
function renderPost2025CarryCard(s, currentYear, year1, nthLabel, borderColor) {
  const won = (v) => (!v && v !== 0) ? '-' : (v * 10000).toLocaleString() + '원';
  const prevData = s.prev || {};
  const curData  = s.currentStats || {};

  const decreased = (s.totalIncrease || 0) === 0 && (s.youthCredit || 0) === 0 && (s.nonYouthCredit || 0) === 0;
  const totalInc  = s.totalIncrease ?? 0;
  const youthInc  = s.youthIncrease ?? 0;
  const nYouthInc = s.nonYouthIncrease ?? 0;

  const statusNote = totalInc <= 0
    ? '<span style="background:#c62828;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px">✗ 감소 — 배제</span>'
    : '<span style="background:#2e7d32;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px">✓ 유지/증가</span>';

  return `
    <div class="result-card" style="border-left:4px solid ${borderColor}">
      <h3>➕ ${year1}년 ${nthLabel} 추가공제
        <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">year1=${year1}년 | ${nthLabel} 단가 적용</span>
        <span style="margin-left:8px">${statusNote}</span>
      </h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        <div style="background:#f9fbe7;border:1px solid #c5e1a5;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#558b2f;margin-bottom:6px">year1 기준 (${year1}년)</div>
          <div style="font-size:13px;color:#555">
            청년 <strong style="color:#2e7d32">${prevData.youth ?? '-'}</strong> /
            청년외 <strong>${prevData.nonYouth ?? '-'}</strong> /
            합계 <strong>${prevData.total ?? '-'}</strong>
          </div>
        </div>
        <div style="background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#1565c0;margin-bottom:6px">당해 (${currentYear}년, year1 기준 규칙)</div>
          <div style="font-size:13px;color:#555">
            청년 <strong style="color:#2e7d32">${curData.youth ?? '-'}</strong> /
            청년외 <strong>${curData.nonYouth ?? '-'}</strong> /
            합계 <strong>${curData.total ?? '-'}</strong>
          </div>
        </div>
        <div style="background:#fff3e0;border:1px solid #ffcc02;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:12px;color:#e65100;margin-bottom:6px">증가인원 (대비 year1)</div>
          <div style="font-size:15px">
            청년 <strong style="color:#2e7d32;font-size:18px">${youthInc}</strong>
            &nbsp;청년외 <strong style="font-size:18px">${nYouthInc}</strong>
            &nbsp;합계 <strong style="color:#1565c0;font-size:18px">${totalInc}</strong>
          </div>
        </div>
      </div>
      <table class="result-table">
        <thead>
          <tr>
            <th>구분</th>
            <th style="text-align:center">증가인원</th>
            <th style="text-align:center">${nthLabel} 1인당 공제액</th>
            <th style="text-align:right">공제액</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>청년 등</strong></td>
            <td style="text-align:center">${youthInc}명</td>
            <td style="text-align:center;color:#1565c0">${won(s.youthUnit)}</td>
            <td style="text-align:right;font-weight:700;color:#2e7d32">${won(s.youthCredit)}</td>
          </tr>
          <tr>
            <td><strong>청년 외</strong></td>
            <td style="text-align:center">${nYouthInc}명</td>
            <td style="text-align:center;color:#1565c0">${won(s.nonYouthUnit)}</td>
            <td style="text-align:right;font-weight:700">${won(s.nonYouthCredit)}</td>
          </tr>
          <tr style="background:#f5f5f5">
            <td colspan="3" style="text-align:right;padding-right:20px;font-weight:600">${nthLabel} 추가공제 소계</td>
            <td style="text-align:right;font-weight:700">${won(s.totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}
