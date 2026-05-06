// ── Tab 1: 상시근로자명세서 입력 ──────────────────────────────────────

let _manualRows = [];

// ── 파일 업로드 초기화 ────────────────────────────────────────────────
function initFileUpload() {
  const input = document.getElementById('excelFile');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.pdf')) {
      showToast('PDF 파일은 지원하지 않습니다. Excel(.xlsx) 파일을 사용해주세요.');
      return;
    }
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', raw: false, cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      parseAndRenderExcelData(rows);
      input.value = '';  // 같은 파일 재선택 시 change 이벤트 발생하도록
    } catch (err) {
      showToast('파일 읽기 오류: ' + err.message);
      input.value = '';
    }
  });
}

// ── 엑셀 파싱 ────────────────────────────────────────────────────────
// 국세청 통합고용세액공제 명세서 여부 감지
// col6 = "⑯내국인" → 계산기 서식과 달리 col6에 내국인 컬럼 추가됨
function detectExcelFormat(rows) {
  if (!rows || !rows[0]) return 'default';
  const h = rows[0];
  if (String(h[6] || '').includes('내국인')) return 'nts';
  return 'default';
}

function parseAndRenderExcelData(rows) {
  const year   = AppState.year;
  const region = AppState.region;
  const format = detectExcelFormat(rows);

  const employees = [];
  // 행 0 = 헤더, 마지막 행이 합계면 스킵
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const nameVal = String(row[1] || '').trim();
    if (!nameVal || nameVal === '합 계' || nameVal === '합계') continue;

    const emp = parseExcelRow(row, year, region, format);
    if (emp) employees.push(emp);
  }

  AppState.employees = employees;
  renderEmployeeData(employees);
  AppState.calcResult = runEngine(AppState);
  updateCurrentYearSummaryRow();
  renderPrevYearsTable();  // 당해년도 행 갱신
  const fmtLabel = format === 'nts' ? ' (국세청 서식)' : '';
  showToast(`${employees.length}명 로드 완료.${fmtLabel}`);
}

// 엑셀 행 → 직원 객체
// 열 순서 (0-indexed): A=0 No, B=1 성명, C=2 생년월일, D=3 상시근로자여부,
// E=4 제외사유, F=5 단시간, G=6 수도권, H=7 입사일, I=8 퇴사일,
// J=9 시작월, K=10 종료월, L=11 근로기간, M=12 기여분, N=13 청년근로기간,
// O=14 청년기여분, P=15 만나이, Q=16 청년여부, R=17 만34초과일,
// S=18 장애인, T=19 고령자, U=20 경력단절, V=21 북한이탈,
// W=22 정규직전환, X=23 육아휴직복귀
// "해당없음" 계열 값을 빈값으로 정규화 (드롭박스에 번호 붙은 형태 포함)
function normalizeExcludeReason(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '-' || s.includes('해당없음') || s.includes('해당 없음')) return '';
  return s;
}

// format: 'nts' = 국세청 통합고용세액공제 명세서 (col6=내국인 추가 → 이후 +1 오프셋)
//         'default' = 계산기 자체 서식
function parseExcelRow(row, year, region, format) {
  const nts = format === 'nts';
  const year1 = year;
  const name          = String(row[1] || '').trim();
  const birthDateStr  = toDateStr(row[2]);
  const dCol          = String(row[3] || '').toUpperCase().trim();
  const excludeReason = normalizeExcludeReason(row[4]);
  const partTypeRaw   = String(row[5] || '').trim();
  const partTimeType  = (partTypeRaw === '0.5' || partTypeRaw === '0.75') ? partTypeRaw : '';
  const rrn           = '';
  const hireDateStr   = toDateStr(row[nts ? 8 : 7]);
  const resignDateStr = toDateStr(row[nts ? 9 : 8]);
  const isDisabled    = String(row[nts ? 19 : 18] || '').toUpperCase() === 'Y';
  const elderlyRaw    = String(row[nts ? 20 : 19] || '').toUpperCase().trim();
  const isCareerBreak = String(row[nts ? 21 : 20] || '').toUpperCase() === 'Y';
  const isNK          = String(row[nts ? 22 : 21] || '').toUpperCase() === 'Y';
  const isRegularConvert = String(row[nts ? 23 : 22] || '').toUpperCase() === 'Y';
  const isParentalLeave  = String(row[nts ? 24 : 23] || '').toUpperCase() === 'Y';

  // D열 우선: Y=포함, N=제외. 없으면 E열 사유로 판단
  let isExcluded;
  if (dCol === 'Y') {
    isExcluded = false;
  } else if (dCol === 'N') {
    isExcluded = true;
  } else {
    isExcluded = !!excludeReason;
  }
  const gender     = getGenderFromRRN(rrn);

  // 생년월일 우선순위: C열 > 주민번호 파싱
  const effectiveBirth = birthDateStr
    || (rrn.length >= 6 ? formatDate(getBirthDateFromRRN(rrn)) : '');
  const isElderly = elderlyRaw
    ? elderlyRaw === 'Y'
    : isElderlyAtHire(effectiveBirth, hireDateStr);

  const isYouth = !isExcluded && isYouthWorker(
    effectiveBirth, hireDateStr, year, year1, gender, 0,
    isDisabled, isElderly, isCareerBreak, isNK
  );

  return {
    name, birthDateStr: effectiveBirth, excludeReason, partTimeType,
    rrn, gender, hireDateStr, resignDateStr, isExcluded,
    isDisabled, isElderly, isCareerBreak, isNK,
    isRegularConvert, isParentalLeave, isYouth, militaryMonths: 0
  };
}

// ── 렌더링 ────────────────────────────────────────────────────────────
function getCurrentRuleYear1ForDisplay() {
  return typeof findLegacyRuleYear1 === 'function'
    ? findLegacyRuleYear1(AppState.prevYears, AppState.year)
    : AppState.year;
}

function renderEmployeeData(employees) {
  const year  = AppState.year;
  const ruleYear1 = getCurrentRuleYear1ForDisplay();

  const processed = employees.map(emp => {
    const calc = calcEmployeeContribution(emp, year, ruleYear1);
    const isYouth = !emp.isExcluded && isYouthWorker(
      emp.birthDateStr, emp.hireDateStr, year, ruleYear1,
      emp.gender, emp.militaryMonths || 0,
      emp.isDisabled, emp.isElderly, emp.isCareerBreak, emp.isNK
    );
    return { ...emp, ...calc, isYouth, ruleYear1 };
  });

  renderTab1Summary(processed);
  renderTab1Table(processed);
}

function renderTab1Summary(processed) {
  const active   = processed.filter(e => !e.isExcluded);
  const excluded = processed.filter(e => e.isExcluded);
  const totalContrib    = round2(active.reduce((s, e) => s + (e.contribution || 0), 0));
  const youthContrib    = round2(active.reduce((s, e) => s + (e.youthContribution || 0), 0));
  const nonYouthContrib = round2(totalContrib - youthContrib);

  AppState.currentStats = {
    total: totalContrib, youth: youthContrib, nonYouth: nonYouthContrib,
    regularConvertCount: active.filter(e => e.isRegularConvert).length,
    parentalLeaveCount:  active.filter(e => e.isParentalLeave).length,
    ruleYear1: processed[0]?.ruleYear1 || AppState.year
  };

  document.getElementById('tab1-summary').innerHTML = `
    <div class="summary-box">
      <div class="summary-item">
        <div class="s-label">전체 근로자</div>
        <div class="s-value">${processed.length}<span style="font-size:16px;font-weight:400">명</span></div>
      </div>
      <div class="summary-item excluded">
        <div class="s-label">상시근로자 제외</div>
        <div class="s-value">${excluded.length}<span style="font-size:16px;font-weight:400">명</span></div>
        <div class="s-sub">포함 대상 ${active.length}명</div>
      </div>
      <div class="summary-item">
        <div class="s-label">총 상시근로자수</div>
        <div class="s-value">${totalContrib}</div>
        <div class="s-sub">연평균</div>
      </div>
      <div class="summary-item youth">
        <div class="s-label">청년 등 상시근로자</div>
        <div class="s-value">${youthContrib}</div>
      </div>
      <div class="summary-item">
        <div class="s-label">청년 외 상시근로자</div>
        <div class="s-value">${nonYouthContrib}</div>
      </div>
      <div class="summary-item">
        <div class="s-label">계산규정 기준연도</div>
        <div class="s-value">${AppState.currentStats.ruleYear1}<span style="font-size:16px;font-weight:400">년</span></div>
      </div>
    </div>`;

  updateCurrentYearSummaryRow();
}

function renderTab1Table(processed) {
  const totalContrib = round2(processed.filter(e=>!e.isExcluded).reduce((s,e)=>s+(e.contribution||0),0));
  const youthContrib = round2(processed.filter(e=>!e.isExcluded).reduce((s,e)=>s+(e.youthContribution||0),0));

  const rows = processed.map((e, i) => {
    const excCls  = e.isExcluded ? ' class="excluded"' : '';
    const dBadge  = e.isExcluded
      ? '<span class="badge badge-n">N</span>'
      : '<span class="badge badge-y">Y</span>';
    const yBadge  = e.isYouth
      ? '<span class="badge badge-y">청년</span>'
      : '<span class="badge badge-n">해당없음</span>';
    const check   = v => v ? '✓' : '';

    return `<tr${excCls}>
      <td>${i + 1}</td>
      <td style="text-align:left;min-width:70px">${e.name}</td>
      <td>${e.birthDateStr || ''}</td>
      <td>${dBadge}</td>
      <td style="text-align:left;max-width:160px;white-space:normal;font-size:11px">${e.excludeReason || '-'}</td>
      <td>${e.partTimeType || '-'}</td>
      <td>${e.hireDateStr || ''}</td>
      <td>${e.resignDateStr || '-'}</td>
      <td>${e.K || '-'}</td>
      <td>${e.L || '-'}</td>
      <td>${e.M || 0}</td>
      <td style="font-weight:${!e.isExcluded?'600':'400'}">${e.contribution || 0}</td>
      <td style="color:${e.isYouth?'#2e7d32':'inherit'};font-weight:${e.isYouth?'600':'400'}">${e.youthContribution || 0}</td>
      <td>${yBadge}</td>
      <td>${check(e.isDisabled)}</td>
      <td>${check(e.isElderly)}</td>
      <td>${check(e.isCareerBreak)}</td>
      <td>${check(e.isNK)}</td>
      <td>${check(e.isRegularConvert)}</td>
      <td>${check(e.isParentalLeave)}</td>
    </tr>`;
  }).join('');

  document.getElementById('tab1-content').innerHTML = `
    <div class="employee-table-wrap mt-16">
      <table class="employee-table">
        <thead>
          <tr>
            <th rowspan="2">No.</th>
            <th rowspan="2">성명</th>
            <th rowspan="2">생년월일</th>
            <th rowspan="2">상시<br>근로자</th>
            <th rowspan="2">제외사유</th>
            <th rowspan="2">단시간<br>유형</th>
            <th rowspan="2">입사일</th>
            <th rowspan="2">퇴사일</th>
            <th colspan="3" class="group-header">근로기간</th>
            <th colspan="2" class="group-header">상시근로자수 기여분</th>
            <th rowspan="2">청년<br>여부</th>
            <th colspan="4" class="group-header">청년 등 특성</th>
            <th colspan="2" class="group-header">추가공제</th>
          </tr>
          <tr>
            <th>시작월(K)</th><th>종료월(L)</th><th>월수(M)</th>
            <th>전체(N)</th><th>청년(P)</th>
            <th>장애</th><th>고령</th><th>경력<br>단절</th><th>북한<br>이탈</th>
            <th>정규<br>전환</th><th>육아<br>복귀</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="11" style="text-align:right;padding-right:12px">합 계</td>
            <td>${totalContrib}</td>
            <td>${youthContrib}</td>
            <td colspan="7"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── 직접 입력 ─────────────────────────────────────────────────────────
function initManualMode() {
  renderManualTable();
}

function addManualEmployeeRow() {
  _manualRows.push({
    name: '', birthDate: '', rrn: '', gender: null,
    excludeReason: '', partTimeType: '',
    hireDateStr: '', resignDateStr: '',
    militaryMonths: 0,
    isDisabled: false, isElderly: false, isCareerBreak: false, isNK: false,
    isRegularConvert: false, isParentalLeave: false
  });
  renderManualTable();
  // 마지막 행 성명 칸에 포커스
  setTimeout(() => {
    const inputs = document.querySelectorAll('.manual-table tbody tr:last-child input[data-field="name"]');
    if (inputs[0]) inputs[0].focus();
  }, 50);
}

function deleteManualRow(idx) {
  _manualRows.splice(idx, 1);
  renderManualTable();
}

function clearManualInputTable() {
  _manualRows = [];
  renderManualTable();
}

function updateManualField(idx, field, value) {
  if (!_manualRows[idx]) return;
  _manualRows[idx][field] = value;
  if (field === 'rrn') {
    _applyRRN(idx, value);
    return;
  }
  if (field === 'birthDate' || field === 'hireDateStr' || field === 'excludeReason') {
    updateManualAutoFlags(idx);
    renderManualTable();
  }
}

function isElderlyAtHire(birthDateStr, hireDateStr) {
  const age = calcManAge(parseDate(birthDateStr), parseDate(hireDateStr));
  return age !== null && age >= 60;
}

function updateManualAutoFlags(idx) {
  const row = _manualRows[idx];
  if (!row) return;
  const birthDate = row.birthDate || (row.rrn ? formatDate(getBirthDateFromRRN(String(row.rrn).replace(/[^0-9]/g, ''))) : '');
  row.isElderly = isElderlyAtHire(birthDate, row.hireDateStr);
}

function syncManualRowsFromDOM() {
  document.querySelectorAll('.manual-table tbody tr').forEach((tr, idx) => {
    const inputs = tr.querySelectorAll('input[data-row-idx]');
    inputs.forEach(inp => {
      if (inp.dataset.field && _manualRows[idx]) {
        _manualRows[idx][inp.dataset.field] = inp.value;
      }
    });
    updateManualAutoFlags(idx);
  });
}

function applyManualBulkValue() {
  const fieldEl = document.getElementById('manualBulkField');
  const valueEl = document.getElementById('manualBulkValue');
  if (!fieldEl || !valueEl) return;

  const field = fieldEl.value;
  const rawValue = String(valueEl.value || '').trim();
  if (!field) return;

  const boolFields = ['isDisabled','isElderly','isCareerBreak','isNK','isRegularConvert','isParentalLeave'];
  _manualRows.forEach(row => {
    row[field] = boolFields.includes(field) ? rawValue.toUpperCase() === 'Y' : rawValue;
  });
  renderManualTable();
}

// RRN 입력 시 8자리 이상이면 즉시 성별·생년월일 감지
function detectRRN(idx, rawValue) {
  const rrn = String(rawValue).replace(/[^0-9]/g, '');
  if (rrn.length < 8) return;
  _manualRows[idx].rrn = rawValue;
  _applyRRN(idx, rawValue);
}

function _applyRRN(idx, rawValue) {
  const rrn    = String(rawValue).replace(/[^0-9]/g, '');
  const gender = getGenderFromRRN(rrn);
  _manualRows[idx].gender = gender;

  // 군복무 칸 즉시 갱신 (DOM 직접)
  const milTd = document.querySelector(`td[data-mil-idx="${idx}"]`);
  if (milTd) {
    if (gender === 'M') {
      if (!milTd.querySelector('input')) {
        milTd.innerHTML = `<input type="number" min="0" max="36"
          value="${_manualRows[idx].militaryMonths || 0}"
          style="width:60px;padding:4px;border:1px solid #ccc;border-radius:3px;text-align:center"
          onchange="updateManualField(${idx},'militaryMonths',+this.value)"
          placeholder="월수">`;
      }
    } else {
      milTd.innerHTML = '<span style="color:#aaa">-</span>';
    }
  }

  // 생년월일 자동채우기 (비어있을 때만)
  if (rrn.length >= 6) {
    const bdInput = document.querySelector(`input[data-row-idx="${idx}"][data-field="birthDate"]`);
    if (bdInput && !bdInput.value) {
      const bd = getBirthDateFromRRN(rrn);
      if (bd) {
        const formatted = formatDate(bd);
        bdInput.value = formatted;
        _manualRows[idx].birthDate = formatted;
      }
    }
  }
  updateManualAutoFlags(idx);
  renderManualTable();
}

function renderManualTable() {
  const region = AppState.region;
  if (!_manualRows.length) {
    document.getElementById('manualInputTable').innerHTML =
      '<p class="text-muted mt-8" style="padding:12px">직원 추가 버튼을 눌러 입력하세요.</p>';
    return;
  }

  const BOOL_FIELDS = ['isDisabled','isElderly','isCareerBreak','isNK','isRegularConvert','isParentalLeave'];
  const BOOL_LABELS = ['장애인','고령자*','경력단절','북한이탈','정규전환','육아복귀'];

  const trs = _manualRows.map((row, idx) => {
    const boolCells = BOOL_FIELDS.map((f, fi) => `
      <td style="min-width:54px">
        <select onchange="updateManualField(${idx},'${f}',this.value==='Y')">
          <option value="N"${!row[f]?' selected':''}>N</option>
          <option value="Y"${row[f]?' selected':''}>Y</option>
        </select>
      </td>`).join('');

    const isMale  = row.gender === 'M';
    const milCell = isMale
      ? `<input type="number" min="0" max="36" value="${row.militaryMonths||0}"
          style="width:60px;padding:4px;border:1px solid #ccc;border-radius:3px;text-align:center"
          onchange="updateManualField(${idx},'militaryMonths',+this.value)" placeholder="월수">`
      : '<span style="color:#aaa">-</span>';

    return `<tr>
      <td style="min-width:80px">
        <input type="text" data-row-idx="${idx}" data-field="name" value="${row.name}"
          onblur="updateManualField(${idx},'name',this.value)" placeholder="성명">
      </td>
      <td style="min-width:70px">
        <select onchange="updateManualField(${idx},'gender',this.value); renderManualTable()">
          <option value="">-</option>
          <option value="M"${isMale?' selected':''}>남성</option>
          <option value="F"${row.gender==='F'?' selected':''}>여성</option>
        </select>
      </td>
      <td style="min-width:110px">
        <input type="text" data-row-idx="${idx}" data-field="birthDate" value="${row.birthDate}"
          oninput="autoFormatDate(this)" onblur="updateManualField(${idx},'birthDate',this.value)"
          placeholder="yyyy-mm-dd" maxlength="10">
      </td>
      <td style="min-width:140px">
        <select onchange="updateManualField(${idx},'excludeReason',this.value)">
          <option value="">-</option>
          <option value="근로계약기간 1년 미만"${row.excludeReason==='근로계약기간 1년 미만'?' selected':''}>1년 미만</option>
          <option value="단시간 근로자"${row.excludeReason==='단시간 근로자'?' selected':''}>단시간 근로자</option>
          <option value="법인의 임원"${row.excludeReason==='법인의 임원'?' selected':''}>법인의 임원</option>
          <option value="최대주주(출자자) 및 그 친족"${row.excludeReason==='최대주주(출자자) 및 그 친족'?' selected':''}>최대주주</option>
          <option value="원천징수사실 미확인 근로자"${row.excludeReason==='원천징수사실 미확인 근로자'?' selected':''}>원천미확인</option>
          <option value="기타"${row.excludeReason==='기타'?' selected':''}>기타</option>
        </select>
      </td>
      <td style="min-width:70px">
        <select onchange="updateManualField(${idx},'partTimeType',this.value)">
          <option value="">-</option>
          <option value="0.5"${row.partTimeType==='0.5'?' selected':''}>0.5</option>
          <option value="0.75"${row.partTimeType==='0.75'?' selected':''}>0.75</option>
        </select>
      </td>
      <td style="min-width:112px">
        <input type="text" data-row-idx="${idx}" data-field="hireDateStr" value="${row.hireDateStr}"
          oninput="autoFormatDate(this)" onblur="updateManualField(${idx},'hireDateStr',this.value)"
          placeholder="yyyy-mm-dd" maxlength="10">
      </td>
      <td style="min-width:112px">
        <input type="text" data-row-idx="${idx}" data-field="resignDateStr" value="${row.resignDateStr}"
          oninput="autoFormatDate(this)" onblur="updateManualField(${idx},'resignDateStr',this.value)"
          placeholder="yyyy-mm-dd (없으면 빈칸)" maxlength="10">
      </td>
      <td style="min-width:56px">
        <input type="text" value="${region}" readonly style="background:#f5f5f5;width:44px;color:#666">
      </td>
      ${boolCells}
      <td style="min-width:70px" data-mil-idx="${idx}">${milCell}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteManualRow(${idx})">삭제</button>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('manualInputTable').innerHTML = `
    <div class="manual-wrap">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px;padding:10px;background:#f5f7fb;border:1px solid #d8e0ef;border-radius:6px">
        <select id="manualBulkField" style="padding:6px;border:1px solid #ccc;border-radius:4px">
          <option value="hireDateStr">입사일</option>
          <option value="resignDateStr">퇴사일</option>
          <option value="partTimeType">단시간 유형</option>
          <option value="excludeReason">제외사유</option>
          <option value="isDisabled">장애인</option>
          <option value="isElderly">고령자</option>
          <option value="isCareerBreak">경력단절</option>
          <option value="isNK">북한이탈</option>
          <option value="isRegularConvert">정규직전환</option>
          <option value="isParentalLeave">육아휴직복귀</option>
        </select>
        <input id="manualBulkValue" type="text" placeholder="일괄 적용 값 (Y/N 또는 날짜)" style="width:210px;padding:6px;border:1px solid #ccc;border-radius:4px">
        <button type="button" class="btn btn-secondary btn-sm" onclick="applyManualBulkValue()">일괄적용</button>
      </div>
      <p style="font-size:11px;color:#888;margin:0 0 6px">
        * 고령자: <strong>입사일(근로계약체결일) 기준 만 60세 이상</strong>만 Y → 청년 등 상시근로자 포함.
        입사 후 60세가 된 경우는 N → 청년 외 상시근로자 포함.
      </p>
      <table class="manual-table">
        <thead>
          <tr>
            <th>성명</th><th>성별</th><th>생년월일</th>
            <th>제외사유</th><th>단시간</th>
            <th>입사일</th><th>퇴사일</th><th>수도권</th>
            ${BOOL_LABELS.map(l=>`<th>${l}</th>`).join('')}
            <th>군복무<br>(월수)</th><th>삭제</th>
          </tr>
        </thead>
        <tbody>${trs}</tbody>
      </table>
    </div>`;
}

function submitManualInput() {
  const year   = AppState.year;
  const region = AppState.region;

  syncManualRowsFromDOM();

  const employees = _manualRows
    .filter(r => r.name.trim())
    .map(r => {
      const isExcluded = !!r.excludeReason;
      const birthDate  = r.birthDate || (r.rrn ? formatDate(getBirthDateFromRRN(r.rrn.replace(/[^0-9]/g,''))) : '');
      const gender     = r.gender || getGenderFromRRN(r.rrn);
      const isElderly  = isElderlyAtHire(birthDate, r.hireDateStr);
      // B안: year1=year
      const isYouth    = !isExcluded && isYouthWorker(
        birthDate, r.hireDateStr, year, year, gender, r.militaryMonths || 0,
        r.isDisabled, isElderly, r.isCareerBreak, r.isNK
      );
      return { ...r, birthDateStr: birthDate, isExcluded, gender, isElderly, region, isYouth };
    });

  AppState.employees = employees;
  renderEmployeeData(employees);
  AppState.calcResult = runEngine(AppState);
  updateCurrentYearSummaryRow();
  renderPrevYearsTable();  // 당해년도 행 갱신
  showToast(`${employees.length}명 저장 및 계산 완료.`);
}

// ── 샘플 서식 다운로드 ────────────────────────────────────────────────
function downloadSampleTemplate() {
  // 이미 만들어진 파일 경로는 브라우저에서 직접 접근 불가 → ExcelJS로 동적 생성
  generateSampleTemplateBlob().then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '상시근로자수_판단_서식_샘플.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  });
}

async function generateSampleTemplateBlob() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('상시근로자수 판단 서식');

  const headers = [
    'No.','성명','생년월일\n(yyyy-mm-dd)',
    '상시근로자\n여부(Y/N)','상시근로자\n제외사유','단시간\n근로자유형',
    '수도권\n여부(Y/N)','근로계약체결일\n(입사일)','퇴사일',
    '시작근로월\n(J)','종료근로월\n(K)','근로기간\n(월수)(L)',
    '상시근로자수\n기여분(M/12)',
    '청년등\n근로기간(N)','청년등\n기여분(N/12)',
    '만나이\n(입사일기준)','청년해당\n(Y/N)',
    '만34세초과일\n(yyyy-mm-dd)',
    '장애인\n(Y/N)','고령자\n(Y/N)\n*입사일 기준\n만60세이상만Y','경력단절\n(Y/N)','북한이탈\n(Y/N)',
    '정규직전환\n(Y/N)','육아휴직복귀\n(Y/N)'
  ];

  const colWidths = [5,12,15,11,24,11,10,16,14,10,10,12,14,12,14,10,10,16,8,8,9,9,11,13];
  const lastCol = headers.length;
  const thinBorder = {
    top:{style:'thin'}, bottom:{style:'thin'},
    left:{style:'thin'}, right:{style:'thin'}
  };
  const center = { horizontal:'center', vertical:'middle', wrapText:true };
  const inputFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFFFFF'} };
  const formulaFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFF3F6FA'} };
  const optionFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFFFF8E1'} };
  const fixedFill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE8F5E9'} };

  const headerRow = ws.addRow(headers);
  headerRow.height = 42;
  for (let col = 1; col <= lastCol; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFBDD7EE'} };
    cell.font = { name:'Arial', bold:true, size:9 };
    cell.alignment = center;
    cell.border = thinBorder;
  }

  // 입력 행: 현재 선택된 지역을 기본값으로 넣고, 고령자는 입사일 기준 자동판정
  for (let i = 2; i <= 31; i++) {
    const r = ws.addRow([]);
    r.getCell(1).value = i - 1;
    r.getCell(4).value = { formula: `IF(E${i}<>"","N","Y")` };  // E열 입력시 자동으로 N
    r.getCell(7).value = AppState.region;
    // J=10(시작월), K=11(종료월), L=12(근로기간), M=13(기여분)
    // N=14(청년근로기간), O=15(청년기여분), P=16(만나이), Q=17(청년해당)
    // R=18(만34세초과일), S=19(장애인), T=20(고령자), U=21(경력단절)
    // V=22(북한이탈), W=23(정규직전환), X=24(육아휴직복귀)
    r.getCell(10).value = { formula: `IF(H${i}<>"",IF(YEAR(H${i})<${AppState.year},1,MONTH(H${i})),"")` };
    r.getCell(11).value = { formula: `IF(I${i}<>"",IF(YEAR(I${i})>${AppState.year},12,IF(DAY(I${i})=DAY(EOMONTH(I${i},0)),MONTH(I${i}),MONTH(I${i})-1)),12)` };
    r.getCell(12).value = { formula: `IF(OR(J${i}="",K${i}="",K${i}<J${i}),0,K${i}-J${i}+1)` };
    r.getCell(13).value = { formula: `IF(D${i}<>"Y",0,ROUNDDOWN(L${i}/12,2))` };
    r.getCell(14).value = { formula: `IF(Q${i}="Y",L${i},0)` };
    r.getCell(15).value = { formula: `IF(Q${i}="Y",M${i},0)` };
    r.getCell(16).value = { formula: `IF(AND(C${i}<>"",H${i}<>""),DATEDIF(C${i},H${i},"Y"),"")` };
    r.getCell(17).value = { formula: `IF(OR(S${i}="Y",T${i}="Y",U${i}="Y",V${i}="Y"),"Y",IF(AND(P${i}<>"",P${i}>=15,P${i}<=34),"Y","N"))` };
    r.getCell(18).value = { formula: `IF(C${i}<>"",DATE(YEAR(C${i})+35,MONTH(C${i}),DAY(C${i})),"")` };
    r.getCell(19).value = 'N';
    r.getCell(20).value = { formula: `IF(AND(C${i}<>"",H${i}<>""),IF(DATEDIF(C${i},H${i},"Y")>=60,"Y","N"),"N")` };
    r.getCell(21).value = 'N';
    r.getCell(22).value = 'N';
    r.getCell(23).value = 'N';
    r.getCell(24).value = 'N';
    r.height = 18;
    for (let col = 1; col <= lastCol; col++) {
      const cell = r.getCell(col);
      cell.font = { name:'Arial', size:9 };
      cell.alignment = center;
      cell.border = thinBorder;
      cell.fill = inputFill;
      if ([1, 7].includes(col)) cell.fill = fixedFill;
      if ([10,11,12,13,14,15,16,17,18,20].includes(col)) cell.fill = formulaFill;
      if ([4,19,21,22,23,24].includes(col)) cell.fill = optionFill;
      if ([3,8,9,18].includes(col)) cell.numFmt = 'yyyy-mm-dd';
      if ([13,15].includes(col)) cell.numFmt = '0.00';
    }
    [4, 7, 19, 20, 21, 22, 23, 24].forEach(col => {
      r.getCell(col).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Y,N"']
      };
    });
    // 열 5(상시근로자 제외사유), 6(단시간근로자유형) 드롭박스 추가
    r.getCell(5).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"1년 미만,단시간 근로자,법인의 임원,최대주주(출자자) 및 그 친족,원천징수사실 미확인 근로자,기타"']
    };
    r.getCell(6).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"0.5,0.75"']
    };
  }

  // 합계행
  const totalRow = ws.addRow([]);
  totalRow.getCell(2).value = '합 계';
  totalRow.getCell(13).value = { formula: 'SUM(M2:M31)' };
  totalRow.getCell(15).value = { formula: 'SUM(O2:O31)' };
  for (let col = 1; col <= lastCol; col++) {
    const cell = totalRow.getCell(col);
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFDDEBF7'} };
    cell.font = { name:'Arial', bold:true, size:9 };
    cell.alignment = center;
    cell.border = thinBorder;
    if ([13,15].includes(col)) cell.numFmt = '0.00';
  }

  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.autoFilter = { from: 'A1', to: 'X1' };
  ws.views = [{ state:'frozen', ySplit:1 }];

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ── 직전 3개년 테이블 현재년도 행 업데이트 ──────────────────────────
function updateCurrentYearSummaryRow() {
  const stats = AppState.currentStats;
  if (!stats) return;
  const yCel  = document.getElementById('curYouthCount');
  const nyCel = document.getElementById('curNonYouthCount');
  if (yCel)  yCel.textContent  = stats.youth;
  if (nyCel) nyCel.textContent = stats.nonYouth;

  // prevYears 현재년도 업데이트
  const year = AppState.year;
  let entry = (AppState.prevYears || []).find(p => p.year === year);
  if (!entry) { entry = { year }; AppState.prevYears.push(entry); }
  entry.youth    = stats.youth;
  entry.nonYouth = stats.nonYouth;
  entry.total    = stats.total;
}

// ── 입력 모드 전환 ────────────────────────────────────────────────────
function switchInputMode(mode) {
  document.getElementById('uploadMode').style.display = mode === 'upload' ? '' : 'none';
  document.getElementById('manualMode').style.display = mode === 'manual' ? '' : 'none';
  document.getElementById('uploadModeBtn').classList.toggle('active', mode === 'upload');
  document.getElementById('manualModeBtn').classList.toggle('active', mode === 'manual');
}
