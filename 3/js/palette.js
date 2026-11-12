// 색 표(design-spec §2), OKLab 보간, 시간대 계산.
export const WEATHERS = ['sunny', 'cloudy', 'rain', 'thunder', 'snow', 'rainbow'];
export const TODS = ['dawn', 'day', 'dusk', 'night'];
export const INK_DARK = '#1B2433';
export const INK_LIGHT = '#FFFBF2';

const SKY = {
  none:    { dawn: ['#A9BDCB', '#D3D6D2', '#F1DCC6'], day: ['#BCD8E6', '#DCE9E6', '#F5EEDC'], dusk: ['#33475C', '#7E6560', '#E3B48C'], night: ['#121C2B', '#1E2C3E', '#38485A'] },
  sunny:   { dawn: ['#7FA9C9', '#BFD3D8', '#F8D6AE'], day: ['#4A9AD4', '#86C8E8', '#DDF0DF'], dusk: ['#2B4C6B', '#9A5B4F', '#F4A95F'], night: ['#0B1B33', '#14365A', '#2F6A86'] },
  cloudy:  { dawn: ['#9BAFBD', '#C7CDCC', '#E8D7C4'], day: ['#8FB3CB', '#BFD2DB', '#E6E7DC'], dusk: ['#3B4A5C', '#84645C', '#DDA27A'], night: ['#141C28', '#242F3E', '#4A5866'] },
  rain:    { dawn: ['#3D5568', '#56707C', '#B9AE9E'], day: ['#3A5A74', '#4F6C82', '#AEBFBC'], dusk: ['#2A3A4C', '#5C4A4E', '#B07F62'], night: ['#0D1620', '#17293A', '#33505F'] },
  thunder: { dawn: ['#2B3448', '#454E60', '#9A8F7E'], day: ['#333D52', '#535D70', '#A89E80'], dusk: ['#232A3A', '#5A3F40', '#B0683F'], night: ['#0A0F1A', '#18202E', '#453F3A'] },
  snow:    { dawn: ['#A8BCD0', '#D3DDE4', '#F2E4DA'], day: ['#B4CDE2', '#DBE7EF', '#F6F4EE'], dusk: ['#3C4F68', '#7A6766', '#E8C3B0'], night: ['#16243A', '#2A3F58', '#6C8295'] },
  rainbow: { dawn: ['#86B4C4', '#C8DCD2', '#F9E0B4'], day: ['#5FB0CF', '#A5DCDA', '#F5EFC6'], dusk: ['#2C5670', '#8C6457', '#F3BE7B'], night: ['#0C2030', '#123F55', '#2F7A80'] },
};
const GROUND = {
  none: ['#4F625F', '#4D6E58', '#3F3F3A', '#16232A'],
  sunny: ['#456C60', '#3F7D55', '#3A4330', '#12272B'],
  cloudy: ['#4D5F5C', '#506A5C', '#3D4142', '#18232A'],
  rain: ['#344B4E', '#365A52', '#2B3536', '#0E1C26'],
  thunder: ['#2A3839', '#304640', '#252727', '#0A1216'],
  snow: ['#DCE5E9', '#EEF3F5', '#5C6A7A', '#27384C'],
  rainbow: ['#4C7A66', '#427B59', '#454F3A', '#10302F'],
};
const CLOUD = {
  dawn:  { clear: ['#F6E7D8', '#D7C8BE'], cloudy: ['#E6E2DA', '#BFC4C4'], rain: ['#4C5E6B', '#36454F'], snow: ['#EDEEF2', '#C7D0DB'] },
  day:   { clear: ['#FFFFFF', '#DCE8F0'], cloudy: ['#F2F4F5', '#C5D0D8'], rain: ['#5B7387', '#425668'], snow: ['#FFFFFF', '#D5E0EA'] },
  dusk:  { clear: ['#7A5450', '#543A3C'], cloudy: ['#6E5450', '#4B3A3E'], rain: ['#3D3A42', '#2B2A33'], snow: ['#7E7078', '#5C5460'] },
  night: { clear: ['#2C3B50', '#1C2838'], cloudy: ['#2A3646', '#1B2532'], rain: ['#1B2633', '#101823'], snow: ['#32445A', '#223246'] },
};
export const SUN = { dawn: ['#FFE3A6', '#FFE3A6', 0.28], day: ['#FFD257', '#FFF1B8', 0.32], dusk: ['#FF9B4E', '#FFB775', 0.40] };
export const MOON = { disc: '#F4EBD0', shade: '#C9C3AE', halo: '#B9C9E0', haloA: 0.22 };
export const FRIEND = { dawn: ['#F7EFE6', '#D8CFC6'], day: ['#FFFFFF', '#D7E1EA'], dusk: ['#F6D8C4', '#D9A78F'], night: ['#DCE4EE', '#A8B5C6'], face: '#2B3344', cheek: 'rgba(255,180,162,.7)' };
export const RAINBOW = ['#8A86CF', '#5AA9DE', '#7FC98B', '#F5D566', '#F2A24C', '#E8695A'];
export const STAR = '#FFF7E3', MILKY = '#CFE0F2', WINDOW = '#FFC66B';

export function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgb2hex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
export function rgba(c, a) { const [r, g, b] = typeof c === 'string' ? hex2rgb(c) : c; return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; }
export function mix(a, b, t) { // sRGB 선형 보간 (design-spec 표기 mix)
  const A = typeof a === 'string' ? hex2rgb(a) : a, B = typeof b === 'string' ? hex2rgb(b) : b;
  return rgb2hex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const toSrgb = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, v * 255)); };
export function toOklab(c) {
  const [R, G, B] = (typeof c === 'string' ? hex2rgb(c) : c).map(toLin);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
}
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export function skyStops(w, tod) { return SKY[w || 'none'][tod]; }
export function ground(w, tod) { return GROUND[w || 'none'][TODS.indexOf(tod)]; }
export function cloudKind(w) { return w === 'cloudy' ? 'cloudy' : (w === 'rain' || w === 'thunder') ? 'rain' : w === 'snow' ? 'snow' : 'clear'; }
export function cloudColors(w, tod) {
  let [light, shade] = CLOUD[tod][cloudKind(w)];
  if (w === 'thunder') { light = mix(light, '#000000', 0.18); shade = mix(shade, '#000000', 0.18); }
  let rim = tod === 'dusk' ? '#F2A76B' : tod === 'night' ? '#8FA6C2' : null;
  if (rim && w === 'thunder') rim = mix(rim, '#000000', 0.35); // 천둥 구름 테두리는 어둡게(글자 대비 보호)
  return { light, shade, rim };
}
// 눈더미 전용 색(fix1-11): 노을·밤에도 눈으로 읽히게. [밝은 면, 밑면 그늘 mix(값,#000,.15)]
const SNOWCAP = { dawn: '#F4F1F2', day: '#FFFFFF', dusk: '#E8D2CB', night: '#AFC0D4' };
export function snowCap(tod) { const v = SNOWCAP[tod]; return [v, mix(v, '#000000', 0.15)]; }
// 하늘 위 글자 잉크 (§2.3)
export function skyInk(w, tod) {
  if (tod === 'dusk' || tod === 'night') return 'light';
  if (w === 'rain' || w === 'thunder') return 'light';
  return 'dark';
}
export function groundInk(w, tod) { return (w === 'snow' && (tod === 'dawn' || tod === 'day')) ? 'dark' : 'light'; }

// 시간대 경계(§2.2): [새벽, 낮, 노을, 밤] 시작 분
const B1 = [330, 420, 1050, 1140], B2 = [270, 390, 1110, 1200], B3 = [360, 450, 990, 1080];
function bounds(month) { return [3, 4, 9, 10].includes(month) ? B1 : [5, 6, 7, 8].includes(month) ? B2 : B3; }
export function todAt(d) {
  const b = bounds(d.getMonth() + 1); const m = d.getHours() * 60 + d.getMinutes();
  if (m >= b[3] || m < b[0]) return 'night';
  if (m < b[1]) return 'dawn';
  if (m < b[2]) return 'day';
  return 'dusk';
}
// 상대 휘도 / 대비 (QA와 같은 식)
export function luminance(c) { const [r, g, b] = (typeof c === 'string' ? hex2rgb(c) : c).map(toLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
