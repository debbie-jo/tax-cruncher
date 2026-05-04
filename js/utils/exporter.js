async function exportExcel() {
  const employees = AppState.employees;
  const result    = AppState.calcResult;
  if (!employees || !employees.length) { showToast('명세서 데이터가 없습니다.'); return; }

  const year  = AppState.year;
  const year1 = AppState.year1;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('상시근로자명세서');

  const headers = [
    'No.','성명','생년월일','상시근로자','제외사유','단시간',
    '주민번호','수도권','입사일','퇴사일',
    '시작월(K)','종료월(L)','근로기간(M)','기여분(N)','청년근로기간(O)','청년기여(P)',
    '만나이','청년여부','만34세초과일',
    '장애인','고령자','경력단절','북한이탈','정규전환','육아복귀'
  ];

  const hRow = ws.addRow(headers);
  hRow.eachCell(cell => {
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FF1A237E'} };
    cell.font = { name:'Arial', bold:true, size:10, color:{argb:'FFFFFFFF'} };
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
    cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  });
  hRow.height = 36;

  employees.forEach((emp, i) => {
    const calc = calcEmployeeContribution(emp, year, year1);
    const age  = emp.birthDateStr && emp.hireDateStr
      ? calcManAge(parseDate(emp.birthDateStr), parseDate(emp.hireDateStr)) : '';
    const s35 = emp.birthDateStr ? getAge35Date(emp.birthDateStr) : '';

    const row = ws.addRow([
      i+1, emp.name, emp.birthDateStr,
      emp.isExcluded ? 'N' : 'Y',
      emp.excludeReason || '', emp.partTimeType || '',
      emp.rrn || '', AppState.region, emp.hireDateStr, emp.resignDateStr || '',
      calc.K || '', calc.L || '', calc.M || 0,
      emp.isExcluded ? 0 : calc.contribution,
      emp.isExcluded ? 0 : (emp.isYouth ? calc.M : 0),
      emp.isExcluded ? 0 : calc.youthContribution,
      age, emp.isYouth ? 'Y' : 'N', s35,
      emp.isDisabled?'Y':'N', emp.isElderly?'Y':'N',
      emp.isCareerBreak?'Y':'N', emp.isNK?'Y':'N',
      emp.isRegularConvert?'Y':'N', emp.isParentalLeave?'Y':'N'
    ]);

    row.eachCell(cell => {
      cell.font = { name:'Arial', size:9 };
      cell.alignment = { horizontal:'center', vertical:'middle' };
      cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
      if (emp.isExcluded) cell.font = { ...cell.font, color:{argb:'FFAAAAAA'} };
    });
    if (!emp.isExcluded && emp.isYouth) {
      row.getCell(17).font = { name:'Arial', size:9, color:{argb:'FF2E7D32'}, bold:true };
    }
    row.height = 16;
  });

  // 합계행
  const n = employees.length;
  const totalRow = ws.addRow([
    '', '합 계', '', '', '', '', '', '', '', '', '', '',
    '', { formula: `SUM(N2:N${n+1})` }, '',
    { formula: `SUM(P2:P${n+1})` }
  ]);
  totalRow.eachCell(cell => {
    cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'FFE8EAF6'} };
    cell.font = { name:'Arial', size:9, bold:true };
    cell.alignment = { horizontal:'center', vertical:'middle' };
    cell.border = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
  });

  ws.views = [{ state:'frozen', ySplit:1 }];
  const colWidths = [5,12,14,10,20,8,15,8,14,14,8,8,10,12,12,12,8,8,14,8,8,8,8,10,10];
  colWidths.forEach((w,i) => { ws.getColumn(i+1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `상시근로자명세서_${AppState.year}년.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Excel 다운로드 완료.');
}

function exportPDF() {
  showToast('PDF 내보내기는 추후 지원 예정입니다.');
}
