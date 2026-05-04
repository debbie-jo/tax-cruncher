// 주민번호 8번째 자리: 1,3,5,7=남 / 2,4,6,8=여
function getGenderFromRRN(rrn) {
  if (!rrn) return null;
  const s = String(rrn).replace(/[^0-9]/g, '');
  if (s.length < 8) return null;
  const code = parseInt(s[7]);
  if ([1, 3, 5, 7].includes(code)) return 'M';
  if ([2, 4, 6, 8].includes(code)) return 'F';
  return null;
}

function getBirthDateFromRRN(rrn) {
  if (!rrn) return null;
  const s = String(rrn).replace(/[^0-9]/g, '');
  if (s.length < 8) return null;
  const code = parseInt(s[7]);
  const yy = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  let century;
  if ([1, 2].includes(code)) century = '19';
  else if ([3, 4].includes(code)) century = '20';
  else if ([5, 6].includes(code)) century = '19'; // 외국인
  else if ([7, 8].includes(code)) century = '20'; // 외국인
  else century = '19';
  return parseDate(`${century}${yy}-${mm}-${dd}`);
}

// 만34세 초과일 = 35번째 생일
function getAge35Date(birthDateStr) {
  const b = parseDate(birthDateStr);
  if (!b) return '';
  const d35 = new Date(b.getFullYear() + 35, b.getMonth(), b.getDate());
  return formatDate(d35);
}
