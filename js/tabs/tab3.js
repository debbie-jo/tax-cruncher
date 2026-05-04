function renderTab3() {
  const container = document.getElementById('tab3-content');
  const result    = AppState.calcResult;

  if (!result) {
    container.innerHTML = '<div class="warn-box">Tab 1에서 명세서를 먼저 입력하세요.</div>';
    return;
  }

  const { year, companyType, region, stream1, stream2, stream3 } = result;

  const won  = (v) => (!v && v !== 0) ? '-' : (v * 10000).toLocaleString() + '원';
  const wonZ = (v) => (v * 10000).toLocaleString() + '원';

  let html = '';

  // ── 스트림1: 당해연도 신규 1차 공제 사후관리 안내 ───────────────────
  if (year >= 2026) {
    html += `
      <div class="result-card" style="border-left:4px solid #1565c0">
        <h3>🔵 ${year}년 신규 1차 공제 — 사후관리</h3>
        <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:12px;color:#1b5e20">
          <strong>year1 ≥ 2026: 신규정 — 사후관리(추징) 폐지</strong><br>
          상시근로자수가 감소하면 해당 연도 공제를 받지 못하는 것으로 종료됩니다. (추징 없음)
        </div>
      </div>`;
  } else {
    const periodLabel = (companyType === 'small' || companyType === 'medium') ? '2년' : '1년';
    html += `
      <div class="result-card" style="border-left:4px solid #1565c0">
        <h3>🔵 ${year}년 신규 1차 공제 — 향후 사후관리 필요</h3>
        <div style="background:#fff3e0;border:1px solid #ffcc02;border-radius:6px;padding:12px;color:#e65100">
          <strong>year1 ≤ 2025: 종전 규정 — 향후 ${periodLabel} 사후관리 적용</strong><br>
          향후 ${periodLabel} 이내 상시근로자수가 ${year}년 수준보다 감소하면 추징됩니다.<br>
          <span style="font-size:12px">
            · 1년차 감소: 2차 추가공제 배제 + 추징 발생<br>
            ${companyType !== 'large' ? `· 2년차 감소(중소·중견): 3차 추가공제 배제 + 추징 발생` : ''}
          </span>
        </div>
      </div>`;
  }

  // ── 2차 사후관리: year1=year-1 ──────────────────────────────────
  if (stream2) {
    html += renderStream2ClawbackCard(stream2, companyType, region, year, won, wonZ);
  }

  // ── 3차 사후관리: year1=year-2 ──────────────────────────────────
  if (stream3) {
    html += renderStream3ClawbackCard(stream3, companyType, region, year, won, wonZ);
  }

  if (!stream2 && !stream3) {
    html += `
      <div class="result-card">
        <p class="text-muted" style="padding:8px">직전 사후관리 대상 스트림이 없습니다. (당해연도가 최초 공제 적용 연도입니다)</p>
      </div>`;
  }

  // ── 정규직전환·육아휴직 추징 안내 ─────────────────────────────────
  if (companyType !== 'large') {
    html += `
      <div class="result-card" style="border-left:4px solid #546e7a">
        <h3>📋 정규직 전환 · 육아휴직 복귀 추징</h3>
        <table class="result-table">
          <thead><tr><th>항목</th><th>추징 조건</th><th>추징세액</th></tr></thead>
          <tbody>
            <tr>
              <td>정규직 전환 공제</td>
              <td style="font-size:12px">전환일로부터 2년 이내 퇴사 시</td>
              <td style="color:#c62828">전환 시 공제받은 세액 전액 추징</td>
            </tr>
            <tr>
              <td>육아휴직 복귀 공제</td>
              <td style="font-size:12px">복직일로부터 2년 이내 퇴사 시</td>
              <td style="color:#c62828">복귀 시 공제받은 세액 전액 추징</td>
            </tr>
          </tbody>
        </table>
        <p class="text-muted mt-8">※ 개별 근로자 단위로 확인이 필요합니다. 명세서 X·Y 열(정규직전환·육아복귀) 대상자를 확인하세요.</p>
      </div>`;
  }

  container.innerHTML = html;
}

// ── 스트림2 사후관리 카드 ─────────────────────────────────────────────
function renderStream2ClawbackCard(stream, companyType, region, year, won, wonZ) {
  const unitCredit = getUnitCredit2024(companyType, region);
  const s          = stream;
  const year1      = s.year1;

  const badgeOk = '<span style="background:#2e7d32;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✓ 유지</span>';
  const badgeNg = '<span style="background:#c62828;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✗ 배제</span>';
  const badge2  = '<span style="background:#e65100;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">② 청년감소</span>';

  const diffTotal = round2(s.currentTotal - s.year1Total);
  const diffYouth = round2(s.currentYouth - s.year1Youth);

  // 추징 계산 노트 (calc에서 이미 계산된 값 사용)
  let clawbackNote = '';
  if (s.clawbackCase === 'A') {
    clawbackNote = `(청년감소 ${s.clawbackYouthDec}명 - 전체감소 ${s.clawbackTotalDec}명) × (${won(unitCredit.youth)} - ${won(unitCredit.nonYouth)}) + 전체감소 ${s.clawbackTotalDec}명 × ${won(unitCredit.youth)}`;
  } else if (s.clawbackCase === 'B') {
    clawbackNote = `청년 감소 ${s.clawbackYouthDec}명 × ${won(unitCredit.youth)} + 청년외 감소 ${s.clawbackNYouthDec}명 × ${won(unitCredit.nonYouth)}`;
  } else if (s.clawbackCase === 'C') {
    clawbackNote = `청년 감소 ${s.clawbackYouthDec}명 × (${won(unitCredit.youth)} - ${won(unitCredit.nonYouth)})`;
  }

  // 결과 박스 결정
  let resultHtml;
  if (!s.isMaintained && s.clawback > 0) {
    // Case A/B: 전체 감소 → 배제 + 추징
    resultHtml = `
      <div style="margin-top:12px;background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;padding:14px">
        <div style="font-weight:700;color:#c62828;margin-bottom:6px;font-size:15px">⚠️ 배제 — 추징 발생 [유형${s.clawbackCase}]</div>
        <div style="font-size:13px;color:#555;margin-bottom:6px">${clawbackNote}</div>
        <div style="font-size:20px;font-weight:700;color:#c62828">추징세액: ${wonZ(s.clawback)}</div>
      </div>`;
  } else if (s.clawbackCase === 'C' && s.clawback > 0) {
    // Case C: 전체 유지, 청년 감소 → 추징 발생
    resultHtml = `
      <div style="margin-top:12px;background:#fff3e0;border:1px solid #ffcc02;border-radius:6px;padding:14px">
        <div style="font-weight:700;color:#e65100;margin-bottom:6px;font-size:15px">⚠️ 전체 유지·청년 감소 — 추징 발생 [유형C]</div>
        <div style="font-size:13px;color:#555;margin-bottom:6px">${clawbackNote}</div>
        <div style="font-size:20px;font-weight:700;color:#e65100">추징세액: ${wonZ(s.clawback)}</div>
        <div style="font-size:12px;color:#888;margin-top:6px">※ 전체 근로자 유지로 2차 추가공제 배제 없음. 청년 감소분 단가 차액만 추징.</div>
      </div>`;
  } else if (s.isMaintained && s.isYouthDecreased) {
    // 청년 감소 (추징=0인 경우: 1차년도에 이미 감소했거나 cap으로 0) → carry credit만 청년외 단가
    resultHtml = `
      <div style="margin-top:12px;background:#fff3e0;border:1px solid #ffcc02;border-radius:6px;padding:12px">
        <div style="font-weight:700;color:#e65100;margin-bottom:6px">⚠️ ② 청년 등 감소 — 청년외 단가 적용</div>
        <div style="font-size:13px">전체 유지되었으나 청년 등이 감소하여 2차 추가공제 전체를 청년외 단가로 계산합니다. 추징세액 없음.</div>
      </div>`;
  } else {
    resultHtml = `
      <div style="margin-top:12px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:10px">
        <div style="color:#1b5e20;font-weight:600">✓ 사후관리 충족 — 추징 없음</div>
      </div>`;
  }

  return `
    <div class="result-card" style="border-left:4px solid #ff8f00">
      <h3>🟡 ${year1}년 공제 2차 사후관리
        <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">${year1}년 기준 vs 당해 ${year}년</span>
      </h3>
      <table class="result-table">
        <thead><tr>
          <th>구분</th>
          <th style="text-align:center">${year1}년</th>
          <th style="text-align:center">당해 (${year}년)</th>
          <th style="text-align:center">증감</th>
          <th style="text-align:center">상태</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>전체 상시근로자</td>
            <td style="text-align:center">${s.year1Total}</td>
            <td style="text-align:center">${s.currentTotal}</td>
            <td style="text-align:center;color:${diffTotal < 0 ? '#c62828' : '#2e7d32'}">
              ${diffTotal >= 0 ? '+' : ''}${diffTotal}
            </td>
            <td style="text-align:center">${s.isMaintained ? badgeOk : badgeNg}</td>
          </tr>
          <tr>
            <td>청년 등</td>
            <td style="text-align:center">${s.year1Youth}</td>
            <td style="text-align:center">${s.currentYouth}</td>
            <td style="text-align:center;color:${diffYouth < 0 ? '#e65100' : '#2e7d32'}">
              ${diffYouth >= 0 ? '+' : ''}${diffYouth}
            </td>
            <td style="text-align:center">
              ${s.isMaintained ? (s.isYouthDecreased ? badge2 : badgeOk) : '<span style="color:#aaa">-</span>'}
            </td>
          </tr>
        </tbody>
      </table>
      ${resultHtml}
    </div>`;
}

// ── 스트림3 사후관리 카드 ─────────────────────────────────────────────
function renderStream3ClawbackCard(stream, companyType, region, year, won, wonZ) {
  const unitCredit = getUnitCredit2024(companyType, region);
  const s          = stream;
  const year1      = s.year1;
  const year2      = s.year2;

  const badgeOk = '<span style="background:#2e7d32;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✓ 유지</span>';
  const badgeNg = '<span style="background:#c62828;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">✗ 배제</span>';
  const badge2  = '<span style="background:#e65100;color:#fff;font-size:11px;padding:2px 8px;border-radius:10px;white-space:nowrap">② 청년감소</span>';

  const y2_ok  = (s.year2Total || 0) >= s.year1Total;
  const cur_ok = s.currentTotal >= s.year1Total;
  const diffCurY1      = round2(s.currentTotal - s.year1Total);
  const diffCurY1Youth = round2(s.currentYouth - s.year1Youth);

  // 추징 노트 (base 기준)
  let baseNote = '';
  if (s.clawbackCase === 'A') {
    baseNote = `(청년감소 ${s.clawbackYouthDec}명 - 전체감소 ${s.clawbackTotalDec}명) × (${won(unitCredit.youth)} - ${won(unitCredit.nonYouth)}) + 전체감소 ${s.clawbackTotalDec}명 × ${won(unitCredit.youth)}`;
  } else if (s.clawbackCase === 'B') {
    baseNote = `청년 감소 ${s.clawbackYouthDec}명 × ${won(unitCredit.youth)} + 청년외 감소 ${s.clawbackNYouthDec}명 × ${won(unitCredit.nonYouth)}`;
  } else if (s.clawbackCase === 'C') {
    baseNote = `청년 감소 ${s.clawbackYouthDec}명 × (${won(unitCredit.youth)} - ${won(unitCredit.nonYouth)})`;
  }
  const priorNote = s.priorClawback > 0
    ? `<div style="font-size:12px;color:#888;margin-top:4px">※ 기준 추징 ${wonZ(s.clawbackBase)} × 2 - 전년도 기납부 추징 ${wonZ(s.priorClawback)}</div>`
    : `<div style="font-size:12px;color:#888;margin-top:4px">※ 기준 추징 ${wonZ(s.clawbackBase)} × 공제횟수 2</div>`;

  // 결과 박스 결정
  let resultHtml;
  if (!y2_ok) {
    // 중간년도(year2) 이미 감소 → stream2에서 추징됨 → 당해 추가 추징 없음
    resultHtml = `
      <div style="margin-top:12px;background:#ffebee;border:1px solid #ef9a9a;border-radius:6px;padding:12px">
        <div style="font-weight:700;color:#c62828;margin-bottom:6px">⚠️ 배제 — 전년도(${year2}년)에 추징됨</div>
        <div style="font-size:13px;color:#555">중간년도(${year2}년) 근로자수 부족으로 전년도에 이미 추징 발생. 당해 추가 추징 없음.</div>
      </div>`;
  } else if (s.clawback > 0) {
    // y2_ok=true, 추징 발생 (Case A/B/C)
    const caseLabel = s.clawbackCase === 'C' ? '전체 유지·청년 감소 — 추징 발생 [유형C]' : `배제 — 추징 발생 [유형${s.clawbackCase}]`;
    const headerColor = s.clawbackCase === 'C' ? '#e65100' : '#c62828';
    const bgColor     = s.clawbackCase === 'C' ? '#fff3e0' : '#ffebee';
    const borderColor = s.clawbackCase === 'C' ? '#ffcc02' : '#ef9a9a';
    resultHtml = `
      <div style="margin-top:12px;background:${bgColor};border:1px solid ${borderColor};border-radius:6px;padding:14px">
        <div style="font-weight:700;color:${headerColor};margin-bottom:6px;font-size:15px">⚠️ ${caseLabel} (× 공제횟수 2)</div>
        <div style="font-size:13px;color:#555;margin-bottom:4px">${baseNote}</div>
        ${priorNote}
        <div style="font-size:20px;font-weight:700;color:${headerColor};margin-top:8px">추징세액: ${wonZ(s.clawback)}</div>
      </div>`;
  } else if (s.isYouthDec_y1) {
    resultHtml = `
      <div style="margin-top:12px;background:#fff3e0;border:1px solid #ffcc02;border-radius:6px;padding:12px">
        <div style="font-weight:700;color:#e65100;margin-bottom:6px">⚠️ ② 청년 등 감소 — 청년외 단가 적용</div>
        <div style="font-size:13px">전체 유지되었으나 청년 등이 감소하여 3차 추가공제 전체를 청년외 단가로 계산합니다. 추징세액 없음.</div>
      </div>`;
  } else {
    resultHtml = `
      <div style="margin-top:12px;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:10px">
        <div style="color:#1b5e20;font-weight:600">✓ 사후관리 충족 — 추징 없음</div>
      </div>`;
  }

  return `
    <div class="result-card" style="border-left:4px solid #6a1b9a">
      <h3>🟣 ${year1}년 공제 3차 사후관리
        <span style="font-size:12px;font-weight:normal;color:#666;margin-left:8px">${year1}년 기준 | 중소·중견기업만</span>
      </h3>
      <div style="background:#f3e5f5;border:1px solid #ce93d8;border-radius:6px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#6a1b9a">
        ※ 3차 요건: ① 중간년도(${year2}년) ≥ ${year1}년 AND ② 당해(${year}년) ≥ ${year1}년 모두 충족 시 공제
      </div>
      <table class="result-table">
        <thead><tr>
          <th>구분</th>
          <th style="text-align:center">${year1}년</th>
          <th style="text-align:center">중간 (${year2}년)</th>
          <th style="text-align:center">당해 (${year}년)</th>
          <th style="text-align:center">상태</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>전체 상시근로자</td>
            <td style="text-align:center">${s.year1Total}</td>
            <td style="text-align:center;color:${y2_ok ? '#2e7d32' : '#c62828'}">${s.year2Total} ${y2_ok ? '✓' : '✗'}</td>
            <td style="text-align:center;color:${cur_ok ? '#2e7d32' : '#c62828'}">${s.currentTotal} ${cur_ok ? '✓' : '✗'}</td>
            <td style="text-align:center">${s.isMaintained_y1 ? badgeOk : badgeNg}</td>
          </tr>
          <tr>
            <td>청년 등</td>
            <td style="text-align:center">${s.year1Youth}</td>
            <td style="text-align:center;color:${(s.year2Youth||0) < s.year1Youth ? '#e65100' : '#2e7d32'}">${s.year2Youth ?? '-'}</td>
            <td style="text-align:center;color:${diffCurY1Youth < 0 ? '#e65100' : '#2e7d32'}">
              ${s.currentYouth} (${diffCurY1Youth >= 0 ? '+' : ''}${diffCurY1Youth})
            </td>
            <td style="text-align:center">
              ${s.isMaintained_y1 ? (s.isYouthDec_y1 ? badge2 : badgeOk) : '<span style="color:#aaa">-</span>'}
            </td>
          </tr>
        </tbody>
      </table>
      ${resultHtml}
    </div>`;
}
