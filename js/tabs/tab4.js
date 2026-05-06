// ── 2차/3차 carry credit youth/nonYouth 분리 헬퍼 ────────────────────
function _getCarryBreakdown(prevYears, year1, companyType, region, isYouthDecreased) {
  const uc = getUnitCredit2024(companyType, region);
  const cur  = (prevYears || []).find(p => p.year === year1)     || {};
  const prev = (prevYears || []).find(p => p.year === year1 - 1) || {};
  const tI = Math.max(0, round2((cur.total || 0) - (prev.total || 0)));
  if (isYouthDecreased) {
    return { youthCredit: 0, nonYouthCredit: round2(tI * uc.nonYouth), tI };
  }
  const yI = Math.max(0, round2((cur.youth || 0) - (prev.youth || 0)));
  const yC = Math.min(yI, tI);
  const nC = Math.max(0, round2(tI - yC));
  return { youthCredit: round2(yC * uc.youth), nonYouthCredit: round2(nC * uc.nonYouth), tI };
}

function renderTab4() {
  const container = document.getElementById('tab4-content');
  const result = AppState.calcResult;
  if (!result) {
    container.innerHTML = '<div class="warn-box">계산 결과가 없습니다. Tab 1에서 명세서를 입력하세요.</div>';
    return;
  }

  const { year, companyType, region, currentStats, stream1, stream2, stream3, prevYears } = result;
  const s1 = stream1 || {};

  // A/B방식 판단: ruleYear1 >= 2025 → 신규정(B방식); ruleYear1 < 2025 → 구규정(A방식)
  const isNewRules = (s1.ruleYear1 || year) >= 2025;
  const method1 = isNewRules ? 'B방식 (개정 후 방식)' : 'A방식 (기존 방식)';

  // 연도별 상시근로자 데이터
  const py2 = (prevYears || []).find(p => p.year === year - 2) || {};
  const py1Raw = (prevYears || []).find(p => p.year === year - 1) || {};
  // ruleYear1 >= 2025: 직전년도를 engine이 신규칙으로 재계산한 값 사용
  const py1 = isNewRules
    ? { total: s1.prevTotal || 0, youth: s1.prevYouth || 0, nonYouth: s1.prevNonYouth || 0 }
    : py1Raw;

  const n  = (v) => (v == null) ? '' : v;
  const nf = (v) => (v == null || v === 0) ? '0' : v;

  // ── 2차 carry 분리 ──────────────────────────────────────────────────
  let s2YouthCredit = 0, s2NonYouthCredit = 0;
  if (stream2 && stream2.isMaintained) {
    const bd = _getCarryBreakdown(prevYears, stream2.year1, companyType, region, stream2.isYouthDecreased);
    s2YouthCredit    = bd.youthCredit;
    s2NonYouthCredit = bd.nonYouthCredit;
  }

  // ── 3차 carry 분리 ──────────────────────────────────────────────────
  let s3YouthCredit = 0, s3NonYouthCredit = 0;
  if (stream3 && stream3.isMaintained_y1) {
    const bd = _getCarryBreakdown(prevYears, stream3.year1, companyType, region, stream3.isYouthDec_y1);
    s3YouthCredit    = bd.youthCredit;
    s3NonYouthCredit = bd.nonYouthCredit;
  }

  // ── 1차 공제세액 테이블 행 (기업유형별) ────────────────────────────
  const typeMap = {
    small:  { metro: '중소 수도권 내', nonMetro: '중소 수도권 밖' },
    medium: { label: '중견기업' },
    large:  { label: '일반기업' }
  };
  const isMetro = region === 'Y';
  let typeLabel = '';
  if (companyType === 'small') {
    typeLabel = isMetro ? '중소기업 수도권 내' : '중소기업 수도권 밖';
  } else if (companyType === 'medium') {
    typeLabel = '중견기업';
  } else {
    typeLabel = '일반기업';
  }

  // ── 2차/3차 감소여부 표시 헬퍼 ─────────────────────────────────────
  const boolCell = (yes, trueTxt = '여', falseTxt = '부') =>
    `<td class="fc-cell ${yes ? 'fc-val-yn' : ''}">${yes ? trueTxt : falseTxt}</td>`;

  // ── HTML 조립 ────────────────────────────────────────────────────────
  container.innerHTML = `
<div class="fc-print-btns" style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
  <button class="btn btn-success" onclick="printSummary()">📋 계산내역 PDF</button>
  <button class="btn btn-success" onclick="printForm()">🖨️ 서식 PDF / 인쇄</button>
  <button class="btn btn-primary" onclick="exportExcel()">📊 명세서 엑셀</button>
</div>

<div class="fc-wrap" id="fc-form">

  <!-- 제목 -->
  <div class="fc-title-row">
    <span class="fc-main-title">통합고용세액공제 공제세액계산서</span>
    <span class="fc-page-note">(3쪽 중 제1쪽)</span>
  </div>

  <!-- ① 신청인 -->
  <table class="fc-table">
    <tbody>
      <tr>
        <td class="fc-label-outer" rowspan="4">① 신청인</td>
        <td class="fc-label">① 상호 또는 법인명</td>
        <td class="fc-input-cell"><input class="fc-input" id="fi-name" placeholder="상호 또는 법인명"></td>
        <td class="fc-label">② 사업자등록번호</td>
        <td class="fc-input-cell"><input class="fc-input" id="fi-bizno" placeholder="000-00-00000"></td>
      </tr>
      <tr>
        <td class="fc-label">③ 대표자 성명</td>
        <td class="fc-input-cell"><input class="fc-input" id="fi-ceo" placeholder="대표자 성명"></td>
        <td class="fc-label">④ 생년월일</td>
        <td class="fc-input-cell"><input class="fc-input" id="fi-dob" placeholder="YYYY-MM-DD"></td>
      </tr>
      <tr>
        <td class="fc-label" colspan="1">⑤ 주소 또는 본점소재지</td>
        <td class="fc-input-cell" colspan="3"><input class="fc-input" id="fi-addr" placeholder="주소 또는 본점소재지" style="width:100%"></td>
      </tr>
      <tr>
        <td class="fc-label" colspan="1"></td>
        <td class="fc-input-cell" colspan="3">
          <span style="font-size:12px;color:#555">(전화번호: </span>
          <input class="fc-input" id="fi-tel" placeholder="전화번호" style="width:200px">
          <span style="font-size:12px;color:#555"> )</span>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- ② 과세연도 -->
  <table class="fc-table" style="margin-top:4px">
    <tbody>
      <tr>
        <td class="fc-label" style="width:120px">② 과세연도</td>
        <td class="fc-val">${year}년 1월 1일부터 &nbsp;&nbsp; ${year}년 12월 31일까지</td>
      </tr>
    </tbody>
  </table>

  <!-- ③ 상시근로자 현황 -->
  <div class="fc-section-title">③ 상시근로자 현황 (작성방법 2,3번을 참고하시기 바랍니다.)</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th" style="width:220px">구분</th>
        <th class="fc-th">직전전 과세연도<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">직전 과세연도<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">해당 과세연도<br><span class="fc-method">${method1}</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-label">⑥ 상시근로자 수 (⑦+⑧)</td>
        <td class="fc-val fc-num">${nf(py2.total)}</td>
        <td class="fc-val fc-num">${nf(py1.total)}</td>
        <td class="fc-val fc-num">${nf(currentStats.total)}</td>
      </tr>
      <tr>
        <td class="fc-label">⑦ 청년등상시근로자 수</td>
        <td class="fc-val fc-num">${nf(py2.youth)}</td>
        <td class="fc-val fc-num">${nf(py1.youth)}</td>
        <td class="fc-val fc-num">${nf(currentStats.youth)}</td>
      </tr>
      <tr>
        <td class="fc-label">⑧ 청년등상시근로자를 제외한 상시근로자 수</td>
        <td class="fc-val fc-num">${nf(py2.nonYouth)}</td>
        <td class="fc-val fc-num">${nf(py1.nonYouth)}</td>
        <td class="fc-val fc-num">${nf(currentStats.nonYouth)}</td>
      </tr>
      ${companyType !== 'large' ? `
      <tr>
        <td class="fc-label">⑨ 정규직 전환 근로자 수</td>
        <td class="fc-val fc-disabled" colspan="2">-</td>
        <td class="fc-val fc-num">${nf(currentStats.regularConvertCount)}</td>
      </tr>
      <tr>
        <td class="fc-label">⑩ 육아휴직 복귀자 수</td>
        <td class="fc-val fc-disabled" colspan="2">-</td>
        <td class="fc-val fc-num">${nf(currentStats.parentalLeaveCount)}</td>
      </tr>` : ''}
    </tbody>
  </table>

  <!-- ④ 기본공제 공제세액 계산내용 -->
  <div class="fc-section-title">④ 기본공제 공제세액 계산내용</div>

  <!-- 가. 1차년도 -->
  <div class="fc-sub-title">가. 1차년도 세제지원 요건 : ⑬ &gt; 0</div>

  <div class="fc-sub2-title">1. 상시근로자 증가 인원</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">⑪ 해당 과세연도 상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑫ 직전 과세연도 상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑬ 상시근로자 증가 인원 수<br>(⑪-⑫)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val fc-num">${nf(currentStats.total)}</td>
        <td class="fc-val fc-num">${nf(s1.prevTotal)}</td>
        <td class="fc-val fc-num fc-bold">${nf(round2(currentStats.total - (s1.prevTotal || 0)))}</td>
      </tr>
    </tbody>
  </table>

  <div class="fc-sub2-title">2. 청년등상시근로자 증가 인원</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">⑭ 해당 과세연도 청년등상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑮ 직전 과세연도 청년등상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑯ 청년등상시근로자 증가인원수<br>(⑭-⑮)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val fc-num">${nf(currentStats.youth)}</td>
        <td class="fc-val fc-num">${nf(s1.prevYouth)}</td>
        <td class="fc-val fc-num fc-bold">${nf(round2(currentStats.youth - (s1.prevYouth || 0)))}</td>
      </tr>
    </tbody>
  </table>

  <div class="fc-sub2-title">3. 청년등상시근로자를 제외한 상시근로자 증가 인원</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">⑰ 해당 과세연도 청년등상시근로자를<br>제외한 상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑱ 직전 과세연도 청년등상시근로자를<br>제외한 상시근로자 수<br><span class="fc-method">${method1}</span></th>
        <th class="fc-th">⑲ 청년등상시근로자를 제외한<br>상시근로자 증가 인원수 (⑰-⑱)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val fc-num">${nf(currentStats.nonYouth)}</td>
        <td class="fc-val fc-num">${nf(s1.prevNonYouth)}</td>
        <td class="fc-val fc-num fc-bold">${nf(round2(currentStats.nonYouth - (s1.prevNonYouth || 0)))}</td>
      </tr>
    </tbody>
  </table>

  <!-- 1차 공제세액 테이블 -->
  <table class="fc-table" style="margin-top:8px">
    <thead>
      <tr>
        <th class="fc-th" colspan="2">구분</th>
        <th class="fc-th">상시근로자 증가인원 수<br>(⑬ 상시근로자 증가인원 수를 한도로 함)</th>
        <th class="fc-th">1인당 공제금액</th>
        <th class="fc-th">⑳ 1차년도 세액공제액</th>
      </tr>
    </thead>
    <tbody>
      ${_render1stCreditRows(companyType, region, s1, currentStats)}
    </tbody>
  </table>

  ${stream2 ? _render2ndYearSection(stream2, year, s2YouthCredit, s2NonYouthCredit, companyType, !isNewRules) : ''}
  ${stream3 ? _render3rdYearSection(stream3, year, s3YouthCredit, s3NonYouthCredit, companyType, !isNewRules) : ''}

  <!-- 합계 -->
  <table class="fc-table fc-total-table" style="margin-top:12px">
    <tbody>
      <tr>
        <td class="fc-label fc-bold" style="text-align:center">총 세액공제액</td>
        <td class="fc-val fc-num fc-total-val">${(result.totalCredit * 10000).toLocaleString()}원</td>
      </tr>
    </tbody>
  </table>

</div><!-- /.fc-wrap -->
`;
}

// ── 1차 공제세액 테이블 행 렌더러 ─────────────────────────────────────
function _render1stCreditRows(companyType, region, s1, currentStats) {
  const won = (v) => v ? (v * 10000).toLocaleString() + '원' : '-';
  const isMetro = region === 'Y';
  const uc = getUnitCredit2024 ? getUnitCredit2024(companyType, region) : null;

  // Post-2025: use s1.youthUnit / s1.nonYouthUnit directly
  const yUnit = s1.youthUnit || 0;
  const nUnit = s1.nonYouthUnit || 0;
  const yInc  = s1.youthIncrease || 0;
  const nInc  = s1.nonYouthIncrease || 0;
  const yCredit = s1.youthCredit || 0;
  const nCredit = s1.nonYouthCredit || 0;

  let rows = '';

  if (companyType === 'small') {
    const locLabel = isMetro ? '수도권 내' : '수도권 밖';
    rows = `
      <tr>
        <td class="fc-label" rowspan="3">중소기업</td>
        <td class="fc-label">청년등 (${locLabel})</td>
        <td class="fc-val fc-num">${yInc}</td>
        <td class="fc-val fc-num">${won(yUnit)}</td>
        <td class="fc-val fc-num fc-bold" rowspan="2">${won(yCredit + nCredit)}</td>
      </tr>
      <tr>
        <td class="fc-label">청년 외 (${locLabel})</td>
        <td class="fc-val fc-num">${nInc}</td>
        <td class="fc-val fc-num">${won(nUnit)}</td>
      </tr>
      <tr>
        <td class="fc-label">계</td>
        <td class="fc-val fc-num" colspan="2"></td>
        <td class="fc-val fc-num fc-bold">${won(s1.totalCredit)}</td>
      </tr>`;
  } else if (companyType === 'medium') {
    rows = `
      <tr>
        <td class="fc-label" rowspan="3">중견기업</td>
        <td class="fc-label">청년등</td>
        <td class="fc-val fc-num">${yInc}</td>
        <td class="fc-val fc-num">${won(yUnit)}</td>
        <td class="fc-val fc-num fc-bold" rowspan="2">${won(yCredit + nCredit)}</td>
      </tr>
      <tr>
        <td class="fc-label">청년 외</td>
        <td class="fc-val fc-num">${nInc}</td>
        <td class="fc-val fc-num">${won(nUnit)}</td>
      </tr>
      <tr>
        <td class="fc-label">계</td>
        <td class="fc-val fc-num" colspan="2"></td>
        <td class="fc-val fc-num fc-bold">${won(s1.totalCredit)}</td>
      </tr>`;
  } else {
    rows = `
      <tr>
        <td class="fc-label" rowspan="3">일반기업</td>
        <td class="fc-label">청년등</td>
        <td class="fc-val fc-num">${yInc}</td>
        <td class="fc-val fc-num">${won(yUnit)}</td>
        <td class="fc-val fc-num fc-bold" rowspan="2">${won(yCredit)}</td>
      </tr>
      <tr>
        <td class="fc-label">청년 외</td>
        <td class="fc-val fc-num">${nInc}</td>
        <td class="fc-val fc-num">-</td>
      </tr>
      <tr>
        <td class="fc-label">계</td>
        <td class="fc-val fc-num" colspan="2"></td>
        <td class="fc-val fc-num fc-bold">${won(s1.totalCredit)}</td>
      </tr>`;
  }

  // 정규직/육아휴직 추가공제 (중소·중견만)
  if (companyType !== 'large') {
    const rUnit = TAX_CREDITS.regularConvert[companyType] || 0;
    const pUnit = TAX_CREDITS.parentalLeave[companyType]  || 0;
    rows += `
      <tr>
        <td class="fc-label" colspan="2">정규직 전환 추가공제</td>
        <td class="fc-val fc-num">${currentStats.regularConvertCount || 0}명</td>
        <td class="fc-val fc-num">${(rUnit * 10000).toLocaleString()}원</td>
        <td class="fc-val fc-num fc-bold">${((s1.regularCredit || 0) * 10000).toLocaleString()}원</td>
      </tr>
      <tr>
        <td class="fc-label" colspan="2">육아휴직 복귀 추가공제</td>
        <td class="fc-val fc-num">${currentStats.parentalLeaveCount || 0}명</td>
        <td class="fc-val fc-num">${(pUnit * 10000).toLocaleString()}원</td>
        <td class="fc-val fc-num fc-bold">${((s1.parentalCredit || 0) * 10000).toLocaleString()}원</td>
      </tr>`;
  }

  return rows;
}

// ── 나. 2차년도 섹션 ─────────────────────────────────────────────────
function _render2ndYearSection(s2, year, yCredit, nCredit, companyType, isAllA) {
  const won = (v) => v != null ? (v * 10000).toLocaleString() + '원' : '-';
  const method = 'A방식 (기존 방식)';
  const totalInc = round2((s2.currentTotal || 0) - (s2.year1Total || 0));
  const totalDec = !s2.isMaintained;
  const youthDec = s2.isYouthDecreased;

  return `
  <div class="fc-sub-title">나. 2차년도 세제지원 요건 : ㉒ ≥ 0</div>

  <div class="fc-sub2-title">1. 상시근로자 증가 인원</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">⑳ 2차년도(해당 과세연도)<br>상시근로자 수<br><span class="fc-method">${method}</span></th>
        <th class="fc-th">㉑ 1차년도(직전 과세연도)<br>상시근로자 수<br><span class="fc-method">${method}</span></th>
        <th class="fc-th">㉒ 상시근로자<br>증가 인원수 (⑳-㉑)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val fc-num">${s2.currentTotal}</td>
        <td class="fc-val fc-num">${s2.year1Total}</td>
        <td class="fc-val fc-num fc-bold">${totalInc}</td>
      </tr>
    </tbody>
  </table>

  <div class="fc-sub2-title">2. 2차년도 세액공제액 계산(상시근로자 감소여부)</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">1차년도(직전 과세연도)<br>대비 상시근로자<br>감소여부</th>
        <th class="fc-th">1차년도(직전 과세연도)<br>대비 청년등상시근로자<br>수 감소여부</th>
        <th class="fc-th">㉓ 1차년도(직전 과세연도)<br>청년등 상시근로자 증가<br>세액공제액</th>
        <th class="fc-th">㉔ 1차년도(직전 과세연도)<br>청년 외 상시근로자 증가<br>세액공제액</th>
        <th class="fc-th">㉕ 2차년도<br>세액공제액</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val ${totalDec ? 'fc-val-yn' : ''}">${totalDec ? '여' : '부'}</td>
        <td class="fc-val ${(!totalDec && youthDec) ? 'fc-val-yn' : ''}">${(!totalDec && youthDec) ? '여' : '부'}</td>
        <td class="fc-val fc-num">${s2.isMaintained ? won(yCredit) : '-'}</td>
        <td class="fc-val fc-num">${s2.isMaintained ? won(nCredit) : '-'}</td>
        <td class="fc-val fc-num fc-bold">${won(s2.totalCredit)}</td>
      </tr>
    </tbody>
  </table>`;
}

// ── 다. 3차년도 섹션 (중소·중견기업만) ─────────────────────────────
function _render3rdYearSection(s3, year, yCredit, nCredit, companyType, isAllA) {
  const won = (v) => v != null ? (v * 10000).toLocaleString() + '원' : '-';
  const method = 'A방식 (기존 방식)';
  const totalInc = round2((s3.currentTotal || 0) - (s3.year1Total || 0));
  const totalDec = !s3.isMaintained_y1;
  const youthDec = s3.isYouthDec_y1;

  return `
  <div class="fc-sub-title">다. 3차년도 세제지원 요건(중소·중견기업만 해당) : ㉗ ≥ 0</div>

  <div class="fc-sub2-title">1. 상시근로자 증가 인원</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">㉖ 3차년도(해당 과세연도)<br>상시근로자 수<br><span class="fc-method">${method}</span></th>
        <th class="fc-th">㉑ 1차년도(직전전 과세연도)<br>상시근로자 수<br><span class="fc-method">${method}</span></th>
        <th class="fc-th">㉗ 상시근로자<br>증가인원 (㉖-㉑)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val fc-num">${s3.currentTotal}</td>
        <td class="fc-val fc-num">${s3.year1Total}</td>
        <td class="fc-val fc-num fc-bold">${totalInc}</td>
      </tr>
    </tbody>
  </table>

  <div class="fc-sub2-title">2. 3차년도 세액공제액 계산(상시근로자 감소여부)</div>
  <table class="fc-table">
    <thead>
      <tr>
        <th class="fc-th">1차년도(직전전 과세연도)<br>대비 상시근로자<br>감소여부</th>
        <th class="fc-th">1차년도(직전전 과세연도)<br>대비 청년등상시근로자<br>수 감소여부</th>
        <th class="fc-th">㉘ 1차년도(직전전 과세연도)<br>상시근로자 증가<br>세액공제액</th>
        <th class="fc-th">㉙ 1차년도(직전전 과세연도)<br>청년 외 상시근로자 증가<br>세액공제액</th>
        <th class="fc-th">㉚ 3차년도<br>세액공제액</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="fc-val ${totalDec ? 'fc-val-yn' : ''}">${totalDec ? '여' : '부'}</td>
        <td class="fc-val ${(!totalDec && youthDec) ? 'fc-val-yn' : ''}">${(!totalDec && youthDec) ? '여' : '부'}</td>
        <td class="fc-val fc-num">${s3.isMaintained_y1 ? won(yCredit) : '-'}</td>
        <td class="fc-val fc-num">${s3.isMaintained_y1 ? won(nCredit) : '-'}</td>
        <td class="fc-val fc-num fc-bold">${won(s3.totalCredit)}</td>
      </tr>
    </tbody>
  </table>`;
}
