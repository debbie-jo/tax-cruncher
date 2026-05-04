function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\./g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

// Convert Excel cell value (number/string/date) to yyyy-mm-dd string
function toDateStr(val) {
  if (!val && val !== 0) return '';
  if (val instanceof Date) return formatDate(val);
  if (typeof val === 'number') {
    // Excel serial date number
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return formatDate(d);
  }
  const s = String(val).trim().replace(/\./g, '-');
  if (/^\d{8}$/.test(s.replace(/-/g, ''))) {
    const raw = s.replace(/-/g, '');
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return s;
  return s;
}

function isEndOfMonth(date) {
  if (!date) return false;
  const d = date instanceof Date ? date : parseDate(date);
  if (!d) return false;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return d.getDate() === last.getDate();
}

// 만나이 계산
function calcManAge(birthDate, refDate) {
  if (!birthDate || !refDate) return null;
  const b = birthDate instanceof Date ? birthDate : parseDate(birthDate);
  const r = refDate instanceof Date ? refDate : parseDate(refDate);
  if (!b || !r) return null;
  let age = r.getFullYear() - b.getFullYear();
  const hadBirthday = r.getMonth() > b.getMonth() ||
    (r.getMonth() === b.getMonth() && r.getDate() >= b.getDate());
  if (!hadBirthday) age--;
  return age;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function roundDown2(n) {
  return Math.floor(n * 100) / 100;
}

function formatNum(n, decimals) {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  if (decimals !== undefined) return num.toFixed(decimals);
  return num.toLocaleString('ko-KR');
}

function showToast(msg, duration) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration || 2500);
}

// Auto-format date input as user types
function autoFormatDate(input) {
  let v = input.value.replace(/[^0-9]/g, '');
  if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
  if (v.length > 7) v = v.slice(0, 7) + '-' + v.slice(7);
  input.value = v.slice(0, 10);
}
