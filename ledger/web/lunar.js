/**
 * 农历 + 二十四节气
 * - 农历：1901–2100 的打包月表（数据由 Node 的 ICU 中文历离线生成，运行时零依赖）
 * - 节气：按太阳视黄经求解（Meeus 低精度），按东八区落日，误差约 15 分钟
 * 只做「公历 → 农历日名 / 节气名」，不引入任何第三方库。
 */

/* ---------------------------------------------------------- 农历月表 */

// 每年一个数：bit0-3 闰月（0=无）｜bit4.. 该年第 i 个月是否 30 天｜bit17 闰月是否 30 天
const YEAR_INFO = [
  0x36d28, 0x07520, 0x0ea50, 0x364a5, 0x064b0, 0x0a9b0, 0x35564, 0x056a0, 0x0b590, 0x37522,
  0x07520, 0x3b256, 0x0b250, 0x0a4b0, 0x34ab5, 0x02ad0, 0x056b0, 0x0b693, 0x0da90, 0x3d927,
  0x0e920, 0x0d250, 0x3a4d6, 0x0a560, 0x02b60, 0x35b54, 0x06d40, 0x0ea90, 0x3e922, 0x0e920,
  0x0d266, 0x052b0, 0x0a570, 0x32b65, 0x0b5a0, 0x06d40, 0x0ec93, 0x07490, 0x36937, 0x0a930,
  0x052b0, 0x0a5b6, 0x0aad0, 0x056a0, 0x3b554, 0x0ba40, 0x0b490, 0x3a932, 0x0a950, 0x352d7,
  0x05360, 0x0aad0, 0x35aa5, 0x0db20, 0x0da40, 0x3d493, 0x0d4a0, 0x0a958, 0x0a970, 0x05560,
  0x0ab56, 0x0ad50, 0x06d20, 0x0ea54, 0x0ea50, 0x064a0, 0x0c973, 0x0a9b0, 0x355a7, 0x056a0,
  0x0b690, 0x37525, 0x0b520, 0x0b250, 0x364b4, 0x0a4b0, 0x34ab8, 0x02ad0, 0x056d0, 0x0b696,
  0x0da90, 0x0d920, 0x3d254, 0x0d250, 0x3a4da, 0x0a560, 0x02b60, 0x05b57, 0x06d50, 0x0ea90,
  0x3e925, 0x0e920, 0x0d260, 0x0a563, 0x0a570, 0x34d68, 0x035a0, 0x06d50, 0x0ec95, 0x07490,
  0x06930, 0x352b4, 0x052b0, 0x0a5b0, 0x355a2, 0x056a0, 0x3b557, 0x0ba40, 0x0b490, 0x3a935,
  0x0a950, 0x052d0, 0x0a6d4, 0x0ab50, 0x35aa9, 0x05d20, 0x0da50, 0x3d4a6, 0x0e4a0, 0x0c950,
  0x352e4, 0x05560, 0x0ab50, 0x35b22, 0x06d20, 0x0ea56, 0x0f250, 0x064a0, 0x0c975, 0x04ab0,
  0x055b0, 0x0ad63, 0x0b690, 0x3752b, 0x0b520, 0x0b250, 0x3a4b6, 0x0a4b0, 0x04ab0, 0x055b5,
  0x05ad0, 0x0b6a0, 0x3b522, 0x0d920, 0x3d257, 0x0d250, 0x0a550, 0x34ad5, 0x04b60, 0x05b50,
  0x0daa3, 0x0ec90, 0x3e928, 0x0e920, 0x0d260, 0x0a566, 0x0a570, 0x04d60, 0x06d54, 0x07550,
  0x07490, 0x0e933, 0x06930, 0x352b7, 0x052b0, 0x0a5b0, 0x355a5, 0x056a0, 0x0b650, 0x374a4,
  0x0b490, 0x3a958, 0x0a950, 0x052d0, 0x0aad6, 0x0ab50, 0x05aa0, 0x0ba54, 0x0da50, 0x0d4a0,
  0x3c953, 0x0c960, 0x394e7, 0x05560, 0x0ab50, 0x35b25, 0x06d20, 0x0ea50, 0x0e4a4, 0x068b0,
  0x0c978, 0x04ab0, 0x055b0, 0x0ad66, 0x0b6a0, 0x07520, 0x37254, 0x0b450, 0x0a8b0, 0x349b2,
  0x04ab0,
];

// 每年「正月初一」相对 1900-01-31 的天数
const YEAR_START = [
  0, 384, 738, 1093, 1476, 1830, 2185, 2569, 2923, 3278, 3662, 4016,
  4400, 4754, 5108, 5492, 5846, 6201, 6585, 6940, 7324, 7678, 8032, 8416,
  8770, 9124, 9509, 9863, 10218, 10602, 10956, 11339, 11693, 12048, 12432, 12787,
  13141, 13525, 13879, 14263, 14617, 14971, 15355, 15710, 16064, 16449, 16803, 17157,
  17541, 17895, 18279, 18633, 18988, 19372, 19727, 20081, 20465, 20819, 21202, 21557,
  21911, 22295, 22650, 23004, 23388, 23743, 24096, 24480, 24835, 25219, 25573, 25928,
  26312, 26666, 27020, 27404, 27758, 28142, 28496, 28851, 29235, 29590, 29944, 30328,
  30682, 31066, 31420, 31774, 32158, 32513, 32868, 33252, 33606, 33960, 34343, 34698,
  35082, 35436, 35791, 36175, 36529, 36883, 37267, 37621, 37976, 38360, 38714, 39099,
  39453, 39807, 40191, 40545, 40899, 41283, 41638, 42022, 42376, 42731, 43115, 43469,
  43823, 44207, 44561, 44916, 45300, 45654, 46038, 46393, 46746, 47130, 47484, 47839,
  48223, 48578, 48962, 49316, 49670, 50054, 50408, 50762, 51146, 51501, 51856, 52240,
  52594, 52978, 53332, 53686, 54070, 54424, 54779, 55163, 55518, 55902, 56256, 56610,
  56993, 57348, 57702, 58086, 58441, 58795, 59179, 59533, 59917, 60271, 60626, 61010,
  61364, 61719, 62103, 62457, 62841, 63195, 63549, 63933, 64288, 64642, 65026, 65381,
  65735, 66119, 66473, 66857, 67211, 67566, 67950, 68304, 68659, 69042, 69396, 69780,
  70134, 70489, 70873, 71228, 71582, 71966, 72320, 72674, 73058,
];

const BASE_YEAR = 1900;
const BASE_UTC = Date.UTC(1900, 0, 31);
const DAY = 86400000;

const MONTH_NAMES = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const DAY_NAMES = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const seqCache = new Map();

/** 某一农历年的月份序列（含闰月） */
function monthsOfYear(idx) {
  if (seqCache.has(idx)) return seqCache.get(idx);
  const info = YEAR_INFO[idx];
  const leap = info & 0xf;
  const leapLen = info & 0x20000 ? 30 : 29;
  const seq = [];
  for (let m = 1; m <= 12; m += 1) {
    seq.push({ month: m, leap: false });
    if (leap === m) seq.push({ month: m, leap: true });
  }
  seq.forEach((s, i) => {
    s.len = info & (0x10 << i) ? 30 : 29;
  });
  if (leap) {
    const li = seq.findIndex((s) => s.leap);
    if (li >= 0) seq[li].len = leapLen;
  }
  seqCache.set(idx, seq);
  return seq;
}

/** 'YYYY-MM-DD' → { year, month, day, isLeap, monthName, dayName } */
export function solarToLunar(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const offset = Math.round((target - BASE_UTC) / DAY);
  if (offset < 0) return null;

  // 二分找农历年
  let lo = 0;
  let hi = YEAR_START.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (YEAR_START[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }

  let rest = offset - YEAR_START[lo];
  const seq = monthsOfYear(lo);
  let slot = seq[0];
  for (const s of seq) {
    if (rest < s.len) {
      slot = s;
      break;
    }
    rest -= s.len;
    slot = s;
  }

  const day = rest + 1;
  return {
    year: BASE_YEAR + lo,
    month: slot.month,
    day,
    isLeap: slot.leap,
    monthName: (slot.leap ? '闰' : '') + MONTH_NAMES[slot.month],
    dayName: DAY_NAMES[day] || '',
  };
}

/** 格子里那行小字：初一显示月名，其余显示日名 */
export function lunarLabel(ymd) {
  const l = solarToLunar(ymd);
  if (!l) return '';
  return l.day === 1 ? l.monthName : l.dayName;
}

/* ---------------------------------------------------------- 二十四节气 */

const TERMS = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
  '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
  '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至',
];

const RAD = Math.PI / 180;
const termCache = new Map();

function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const omega = (125.04 - 1934.136 * T) * RAD;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  return ((lambda % 360) + 360) % 360;
}

/** 某年 24 节气 → Map<'MM-DD', 节气名> */
export function termsOfYear(year) {
  if (termCache.has(year)) return termCache.get(year);
  const out = new Map();
  const jan1 = Date.UTC(year, 0, 1) / DAY + 2440587.5 - 8 / 24;
  for (let i = 0; i < 24; i += 1) {
    const target = (285 + i * 15) % 360;
    let jd = jan1 + i * 15.2;
    for (let k = 0; k < 5; k += 1) {
      const diff = ((target - sunLongitude(jd) + 540) % 360) - 180;
      jd += diff * 1.0146;
      if (Math.abs(diff) < 1e-7) break;
    }
    const dt = new Date((jd - 2440587.5) * DAY + 8 * 3600000);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    out.set(mm + '-' + dd, TERMS[i]);
  }
  termCache.set(year, out);
  return out;
}

/** 'YYYY-MM-DD' → 节气名 | '' */
export function termOf(ymd) {
  const [y, m, d] = String(ymd).split('-');
  return termsOfYear(Number(y)).get(m + '-' + d) || '';
}

/** 格子里显示：节气 > 农历月名（初一）> 农历日名 */
export function cellLabel(ymd) {
  return termOf(ymd) || lunarLabel(ymd);
}

/** 详情用：'九月廿九 · 立冬' */
export function lunarLine(ymd) {
  const l = solarToLunar(ymd);
  if (!l) return '';
  const base = (l.isLeap ? '闰' : '') + MONTH_NAMES[l.month] + l.dayName;
  const term = termOf(ymd);
  return term ? base + ' · ' + term : base;
}
