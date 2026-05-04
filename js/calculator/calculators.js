// 엑셀 업로드된 행 목록에서 상시근로자수 통계 계산 (이전년도 파일 업로드용)
function calcStatsFromRows(rows, year, year1, region) {
  const employees = [];
  for (let i = 1; i < rows.length; i++) {
    const row     = rows[i];
    const nameVal = String(row[1] || '').trim();
    if (!nameVal || nameVal.includes('합')) continue;
    const emp = parseExcelRow(row, year, year1, region);
    if (emp) employees.push(emp);
  }
  return calcStats(employees, year, year1);
}
