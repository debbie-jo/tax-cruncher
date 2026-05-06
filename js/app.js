// ── 전역 상태 ──────────────────────────────────────────────────────────
const AppState = {
  year: 2025,
  companyType: 'small',
  region: 'Y',
  prevYears: [],
  employees: [],
  currentStats: { total: 0, youth: 0, nonYouth: 0, regularConvertCount: 0, parentalLeaveCount: 0 },
  calcResult: null
};

// ── 탭 전환 ────────────────────────────────────────────────────────────
function switchTab(n) {
  syncPrevYearInputs();
  if (n >= 2 && AppState.employees && AppState.employees.length > 0) {
    AppState.calcResult = runEngine(AppState);
  }
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${n}`).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${n}"]`).classList.add('active');
  document.getElementById('progressText').textContent = `${n}/4`;
  if (n === 2) renderTab2();
  if (n === 3) renderTab3();
  if (n === 4) renderTab4();
}

// ── 연도 전환 ──────────────────────────────────────────────────────────
function switchYear(year) {
  AppState.year = parseInt(year);
  renderPrevYearsTable();
  triggerRecalculate();
}

// ── 회사정보 변경 ──────────────────────────────────────────────────────
function onCompanyInfoChange() {
  AppState.companyType = document.getElementById('companyType').value;
  AppState.region      = document.getElementById('regionSelect').value;
  if (typeof syncManualRowsFromDOM === 'function') syncManualRowsFromDOM();
  if (typeof renderManualTable === 'function') renderManualTable();
  triggerRecalculate();
}

// ── 재계산 트리거 ──────────────────────────────────────────────────────
function triggerRecalculate() {
  if (AppState.employees && AppState.employees.length > 0) {
    syncPrevYearInputs();
    const year   = AppState.year;
    const employees = AppState.employees.map(emp => {
      // B안: year1=year (신규 1차 스트림 기준으로 청년 판단)
      const isYouth = !emp.isExcluded && isYouthWorker(
        emp.birthDateStr, emp.hireDateStr, year, year,
        emp.gender, emp.militaryMonths || 0,
        emp.isDisabled, emp.isElderly, emp.isCareerBreak, emp.isNK
      );
      return { ...emp, isYouth };
    });
    AppState.employees = employees;
    renderEmployeeData(employees);
    AppState.calcResult = runEngine(AppState);
    updateCurrentYearSummaryRow();
  }
}

// ── 직전 3개년 테이블 렌더 ─────────────────────────────────────────────
function renderPrevYearsTable() {
  const year  = AppState.year;
  const tbody = document.getElementById('prevYearsBody');
  tbody.innerHTML = '';

  for (let y = year - 3; y <= year; y++) {
    const isCurrentYear = (y === year);
    const saved = (AppState.prevYears || []).find(p => p.year === y) || {};
    const tr    = document.createElement('tr');

    tr.innerHTML = `
      <td style="text-align:center;padding:8px 12px;border:1px solid #ffe082;font-weight:${isCurrentYear?'bold':'normal'};color:${isCurrentYear?'#1565c0':'inherit'}">
        ${y}년${isCurrentYear?' <span style="font-size:11px">(당해)</span>':''}
      </td>
      <td style="padding:6px 12px;border:1px solid #ffe082;text-align:center">
        ${isCurrentYear
          ? `<span id="curYouthCount" style="font-weight:700;color:#2e7d32">${saved.youth ?? '-'}</span>`
          : `<input type="number" step="0.01" min="0" value="${saved.youth ?? ''}"
              data-prev-year="${y}" data-prev-field="youth"
              style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;text-align:center"
              onchange="onPrevYearChange(${y},'youth',this.value)">`}
      </td>
      <td style="padding:6px 12px;border:1px solid #ffe082;text-align:center">
        ${isCurrentYear
          ? `<span id="curNonYouthCount" style="font-weight:700">${saved.nonYouth ?? '-'}</span>`
          : `<input type="number" step="0.01" min="0" value="${saved.nonYouth ?? ''}"
              data-prev-year="${y}" data-prev-field="nonYouth"
              style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;text-align:center"
              onchange="onPrevYearChange(${y},'nonYouth',this.value)">`}
      </td>
      <td style="padding:6px 12px;border:1px solid #ffe082;text-align:center">
        ${isCurrentYear
          ? '<span style="font-size:12px;color:#666">당해연도 명세서 입력에서 자동 계산</span>'
          : `<div style="display:flex;gap:6px;justify-content:center;align-items:center">
               <input type="file" accept=".xlsx" style="display:none" id="prevFile${y}" onchange="uploadPrevYear(${y},this)">
               <button class="btn btn-primary btn-sm" onclick="document.getElementById('prevFile${y}').click()">📁 업로드</button>
               ${saved.total ? `<span style="font-size:11px;color:#2e7d32;font-weight:600">✅ 총 ${saved.total}명</span>` : ''}
             </div>`}
      </td>`;
    tbody.appendChild(tr);
  }
}

function updatePrevYear(year, field, value) {
  let entry = (AppState.prevYears || []).find(p => p.year === year);
  if (!entry) { entry = { year, youth: 0, nonYouth: 0, total: 0 }; AppState.prevYears.push(entry); }
  entry[field] = parseFloat(value) || 0;
  entry.total  = round2((entry.youth || 0) + (entry.nonYouth || 0));
}

// 직전년도 입력 즉시 재계산 (syncPrevYearInputs 루프 없이)
function onPrevYearChange(year, field, value) {
  updatePrevYear(year, field, value);
  if (AppState.employees && AppState.employees.length > 0) {
    renderEmployeeData(AppState.employees);
    AppState.calcResult = runEngine(AppState);
    updateCurrentYearSummaryRow();
  }
}

function syncPrevYearInputs() {
  document.querySelectorAll('#prevYearsBody input[data-prev-year][data-prev-field]').forEach(input => {
    updatePrevYear(parseInt(input.dataset.prevYear), input.dataset.prevField, input.value);
  });
}

async function uploadPrevYear(year, input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const data = await file.arrayBuffer();
    const wb   = XLSX.read(data, { type: 'array', raw: false, cellDates: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

    const format = detectExcelFormat(rows);
    const employees = [];
    for (let i = 1; i < rows.length; i++) {
      const row     = rows[i];
      const nameVal = String(row[1] || '').trim();
      if (!nameVal || nameVal.includes('합')) continue;
      // 직전년도 파일: year1=해당 연도 (각 연도 기준으로 청년 판단)
      const emp = parseExcelRow(row, year, AppState.region, format);
      if (emp) employees.push(emp);
    }

    const stats = calcStats(employees, year, year);
    let entry = (AppState.prevYears || []).find(p => p.year === year);
    if (!entry) { entry = { year }; AppState.prevYears.push(entry); }
    entry.youth    = stats.youth;
    entry.nonYouth = stats.nonYouth;
    entry.total    = stats.total;

    renderPrevYearsTable();
    showToast(`${year}년 파일 업로드 완료. 상시근로자 ${stats.total}명`);
  } catch (err) {
    showToast('파일 오류: ' + err.message);
  }
}

function savePrevYearsAndCalculate() {
  syncPrevYearInputs();
  AppState.calcResult = runEngine(AppState);
  const msg = document.getElementById('prevYearSavedMsg');
  msg.style.display = 'inline';
  setTimeout(() => msg.style.display = 'none', 2000);
  showToast('저장 완료.');
}

// ── 초기화 ────────────────────────────────────────────────────────────
function clearAllData() {
  if (!confirm('모든 데이터를 초기화합니까?')) return;
  AppState.employees   = [];
  AppState.currentStats = { total: 0, youth: 0, nonYouth: 0, regularConvertCount: 0, parentalLeaveCount: 0 };
  AppState.calcResult  = null;
  document.getElementById('tab1-content').innerHTML  = '';
  document.getElementById('tab1-summary').innerHTML  = '';
  document.getElementById('excelFile').value         = '';
  clearManualInputTable();
  updateCurrentYearSummaryRow();
  showToast('초기화 완료.');
}

function clearManualInput() {
  clearManualInputTable();
}

// ── 프로젝트 저장/불러오기 ─────────────────────────────────────────────
function saveProject() {
  const data = JSON.stringify({
    year: AppState.year,
    companyType: AppState.companyType, region: AppState.region,
    prevYears: AppState.prevYears, employees: AppState.employees
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `통합고용세액공제_${AppState.year}년.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function loadProject() {
  const input   = document.createElement('input');
  input.type    = 'file';
  input.accept  = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      Object.assign(AppState, data);
      document.getElementById('yearSelect').value    = AppState.year;
      document.getElementById('companyType').value   = AppState.companyType;
      document.getElementById('regionSelect').value  = AppState.region;
      switchYear(AppState.year);
      if (AppState.employees && AppState.employees.length > 0) {
        renderEmployeeData(AppState.employees);
        AppState.calcResult = runEngine(AppState);
        updateCurrentYearSummaryRow();
      }
      showToast('프로젝트 불러오기 완료.');
    } catch (err) {
      showToast('파일 오류: ' + err.message);
    }
  };
  input.click();
}

// ── 계산내역 요약 PDF ──────────────────────────────────────────────────
function printSummary() {
  const result = AppState.calcResult;
  if (!result) { showToast('계산 결과가 없습니다.'); return; }

  const { year, companyType, region, currentStats, stream1, stream2, stream3, prevYears, totalCredit } = result;
  const s1 = stream1 || {};
  const bizName = document.getElementById('fi-name')?.value || '';
  const typeLabel = { small:'중소기업', medium:'중견기업', large:'대기업' }[companyType] || '';
  const regionLabel = region === 'Y' ? '수도권' : '비수도권';
  const won = (v) => v != null ? (v * 10000).toLocaleString() + '원' : '-';

  // 연도별 근로자 행
  let yearRows = '';
  for (let y = year - 3; y <= year; y++) {
    const d = y === year ? currentStats : ((prevYears || []).find(p => p.year === y) || {});
    const isCur = y === year;
    yearRows += `<tr${isCur ? ' style="background:#e3f2fd;font-weight:600"' : ''}>
      <td>${y}년${isCur ? ' (당해)' : ''}</td>
      <td style="color:#2e7d32">${d.youth ?? '-'}</td>
      <td>${d.nonYouth ?? '-'}</td>
      <td style="font-weight:700">${d.total ?? '-'}</td>
    </tr>`;
  }

  // 1차 공제 행
  const extraRows = companyType !== 'large' ? `
    <tr><td>정규직 전환</td><td>${currentStats.regularConvertCount || 0}명</td><td>${won(TAX_CREDITS.regularConvert[companyType])}</td><td>${won(s1.regularCredit)}</td></tr>
    <tr><td>육아휴직 복귀</td><td>${currentStats.parentalLeaveCount || 0}명</td><td>${won(TAX_CREDITS.parentalLeave[companyType])}</td><td>${won(s1.parentalCredit)}</td></tr>` : '';

  // 2차 요약
  const s2Row = stream2 ? `
    <tr style="background:#fff8e1">
      <td colspan="3" style="text-align:right;font-weight:600">${stream2.year1}년 기준 2차 추가공제
        ${stream2.isMaintained ? '' : '<span style="color:#c62828"> (상시근로자 감소 — 배제)</span>'}
        ${stream2.isMaintained && stream2.isYouthDecreased ? '<span style="color:#e65100"> (청년 감소 — 청년외 단가)</span>' : ''}
      </td>
      <td style="font-weight:700;color:#e65100">${won(stream2.totalCredit)}</td>
    </tr>` : '';

  // 3차 요약
  const s3Row = stream3 ? `
    <tr style="background:#f3e5f5">
      <td colspan="3" style="text-align:right;font-weight:600">${stream3.year1}년 기준 3차 추가공제
        ${stream3.isMaintained_y1 ? '' : '<span style="color:#c62828"> (배제)</span>'}
      </td>
      <td style="font-weight:700;color:#6a1b9a">${won(stream3.totalCredit)}</td>
    </tr>` : '';

  const html = `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8">
<title>통합고용세액공제 계산내역_${year}년${bizName ? '_' + bizName : ''}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Apple SD Gothic Neo','Noto Sans KR',Arial,sans-serif; font-size:13px; color:#222; padding:24px; }
  h2 { font-size:17px; text-align:center; margin-bottom:4px; }
  .sub { text-align:center; color:#555; font-size:12px; margin-bottom:18px; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th,td { border:1px solid #bbb; padding:6px 10px; }
  th { background:#e8eaf6; font-weight:600; text-align:center; }
  td { text-align:center; }
  .sec { font-weight:700; background:#f0f4f8; padding:5px 8px; font-size:13px;
         border-left:4px solid #3949ab; margin:14px 0 4px; }
  .total-row td { background:#e3f2fd; font-size:15px; font-weight:700; color:#1565c0; }
  @media print { body { padding:8px; } }
</style></head><body>
<h2>통합고용세액공제 계산내역</h2>
<div class="sub">${year}년 / ${typeLabel} / ${regionLabel}${bizName ? ' / ' + bizName : ''}</div>

<div class="sec">상시근로자 현황</div>
<table>
  <thead><tr><th>연도</th><th>청년 등</th><th>청년 외</th><th>합계</th></tr></thead>
  <tbody>${yearRows}</tbody>
</table>

<div class="sec">1차년도 기본공제 (${year}년)</div>
<table>
  <thead><tr><th>구분</th><th>증가인원</th><th>1인당 공제액</th><th>공제액</th></tr></thead>
  <tbody>
    <tr><td>청년 등</td><td>${s1.youthIncrease ?? 0}명</td><td>${won(s1.youthUnit)}</td><td style="font-weight:700;color:#2e7d32">${won(s1.youthCredit)}</td></tr>
    <tr><td>청년 외</td><td>${s1.nonYouthIncrease ?? 0}명</td><td>${won(s1.nonYouthUnit)}</td><td style="font-weight:700">${won(s1.nonYouthCredit)}</td></tr>
    ${extraRows}
    <tr style="background:#f5f5f5"><td colspan="3" style="text-align:right;font-weight:600">1차 소계</td><td style="font-weight:700">${won(s1.totalCredit)}</td></tr>
    ${s2Row}${s3Row}
    <tr class="total-row"><td colspan="3" style="text-align:right">총 세액공제액</td><td>${(totalCredit * 10000).toLocaleString()}원</td></tr>
  </tbody>
</table>
</body></html>`;

  const w = window.open('', '_blank', 'width=750,height=900');
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}

// ── 서식 PDF 인쇄 ─────────────────────────────────────────────────────
function printForm() {
  const name = document.getElementById('fi-name')?.value || '';
  const year = AppState.year;
  const prev = document.title;
  document.title = `통합고용세액공제_공제세액계산서_${year}년${name ? '_' + name : ''}`;
  window.print();
  document.title = prev;
}

// ── 앱 초기화 ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  switchYear(2025);
  initFileUpload();
  initManualMode();
});
