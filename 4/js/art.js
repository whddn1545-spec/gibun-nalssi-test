// 움직이지 않는 장면 그림(SVG 문자열): 공유 카드·하루 시트·예보 카드에 쓴다.
// 오늘 화면의 살아 있는 하늘(index.html의 #scene)과 같은 그림을 색을 직접 넣어 다시 그린 것.
const INK = '#46352D';
const CB = 'M-58 41C-86 41-98 11-76-3C-84-30-54-48-34-34C-26-62 14-70 30-46C48-60 80-46 74-18C98-10 94 41 62 41C30 45-26 45-58 41Z';
const PUFF = (fill) => `<g fill="${fill}"><circle cx="-22" cy="2" r="15"/><circle cx="2" cy="-8" r="20"/><circle cx="25" cy="3" r="14"/><rect x="-37" y="2" width="76" height="15" rx="7.5"/></g>`;
const DROP = 'M0-6C2.6-2.2 4.4.8 4.4 3.2A4.4 4.4 0 0 1-4.4 3.2C-4.4.8-2.6-2.2 0-6Z';
const SPARK = 'M0-10C1.4-2.6 2.6-1.4 10 0 2.6 1.4 1.4 2.6 0 10-1.4 2.6-2.6 1.4-10 0-2.6-1.4-1.4-2.6 0-10Z';
const FLOWER = '<circle cy="-4.6" r="4"/><circle cx="4.4" cy="-1.4" r="4"/><circle cx="2.7" cy="3.7" r="4"/><circle cx="-2.7" cy="3.7" r="4"/><circle cx="-4.4" cy="-1.4" r="4"/>';

export const SKY = {
  initial: ['#D2CBF1', '#EFD9EE', '#FFE3D2'],
  sunny: ['#94D2F1', '#C8E9F6', '#FFF2D8'],
  rainbow: ['#A2DDEA', '#DAF0EC', '#FFDCE6'],
  cloudy: ['#B3BFD3', '#D5D8E1', '#EFE7DF'],
  snow: ['#A9BBE7', '#D2DBF3', '#F2EEF9'],
  rain: ['#7187B1', '#93A5C6', '#B9C5D9'],
  thunder: ['#43386A', '#645488', '#8B7BA5'],
};
const SCN = {
  initial: { hb: '#CBE0C6', hf: '#B3D4AD', hs: 'none', body: '#FFFFFF', shade: '#ECE3F7', bgc: '#FFF4F6', bgco: 0.85, fx: 175, fy: 236, fs: 0.9 },
  sunny: { hb: '#BEE4A6', hf: '#9DD48D', hs: 'none', body: '#FFFFFF', shade: '#FFE7C6', bgc: '#FFFFFF', bgco: 0.95, fx: 100, fy: 190, fs: 0.6 },
  rainbow: { hb: '#C3EAC6', hf: '#A2DCB2', hs: 'none', body: '#FFFFFF', shade: '#FFDCE8', bgc: '#FFFFFF', bgco: 0.9, fx: 175, fy: 198, fs: 0.74 },
  cloudy: { hb: '#C7D2C2', hf: '#ADC0AA', hs: 'none', body: '#E8E9F2', shade: '#CDD0E1', bgc: '#F3F3F8', bgco: 1, fx: 176, fy: 152, fs: 0.98 },
  snow: { hb: '#EEF2FC', hf: '#FFFFFF', hs: '#C3CFEC', body: '#F7FAFF', shade: '#D7E1F6', bgc: '#F4F7FF', bgco: 0.55, fx: 176, fy: 134, fs: 0.86 },
  rain: { hb: '#9FB5A8', hf: '#88A395', hs: 'none', body: '#B2C5E4', shade: '#90A8D1', bgc: '#C4CEE1', bgco: 0.9, fx: 178, fy: 114, fs: 0.88 },
  thunder: { hb: '#7C7299', hf: '#695E88', hs: 'none', body: '#9586BA', shade: '#7767A1', bgc: '#7D709E', bgco: 0.95, fx: 178, fy: 110, fs: 0.92 },
};

const ln = (d, w = 3.4) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const mo = (d) => `<path d="${d}" fill="#8C3D33" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
const blush = (cx, cy, rx, ry, fill = '#FF9C9C', op = 0.6) => `<ellipse cx="${-cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`;

const FACE = {
  initial: `<ellipse cx="-24" cy="5" rx="6.6" ry="7.8" fill="${INK}"/><ellipse cx="24" cy="5" rx="6.6" ry="7.8" fill="${INK}"/>
    <circle cx="-21.8" cy="1.6" r="2.4" fill="#fff"/><circle cx="26.2" cy="1.6" r="2.4" fill="#fff"/>
    <ellipse cx="0" cy="20" rx="3.6" ry="4.2" fill="#8C3D33" stroke="${INK}" stroke-width="2.6"/>${blush(42, 16, 7, 4.4)}`,
  sunny: `${ln('M-31 8Q-24-1-17 8M17 8Q24-1 31 8')}${mo('M-9 14C-9 26 9 26 9 14Z')}
    <path d="M-5 20.2C-2 18 2 18 5 20.2 3 23.2-3 23.2-5 20.2Z" fill="#FF8E86"/>${blush(42, 16, 8, 5)}`,
  rainbow: `<g transform="translate(-24 5)"><path d="M0-9L2.5-3.4 8.6-2.8 4 1.3 5.3 7.3 0 4.2-5.3 7.3-4 1.3-8.6-2.8-2.5-3.4Z" fill="#FFD54F" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></g>
    <g transform="translate(24 5)"><path d="M0-9L2.5-3.4 8.6-2.8 4 1.3 5.3 7.3 0 4.2-5.3 7.3-4 1.3-8.6-2.8-2.5-3.4Z" fill="#FFD54F" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/></g>
    ${mo('M-12 13C-12 30 12 30 12 13Z')}<path d="M-6.5 22C-2.5 19 2.5 19 6.5 22 4 26-4 26-6.5 22Z" fill="#FF8E86"/>${blush(43, 17, 8.5, 5.2, '#FF88A8', 0.75)}`,
  cloudy: `<path d="M-30.5 5A6.5 6.5 0 0 0-17.5 5Z" fill="${INK}"/><path d="M17.5 5A6.5 6.5 0 0 0 30.5 5Z" fill="${INK}"/>
    ${ln('M-32.5 4.6H-15.5M15.5 4.6H32.5')}${ln('M-7 20Q-3.5 17.4 0 20T7 20', 2.8)}`,
  snow: `${ln('M-30 4Q-24 10.5-18 4M18 4Q24 10.5 30 4')}${ln('M-5 16.5Q0 20.5 5 16.5', 2.8)}${blush(41, 13, 7, 4.2, '#F5A8C2', 0.5)}`,
  rain: `${ln('M-33-3Q-26-8.5-17-10M33-3Q26-8.5 17-10')}
    <ellipse cx="-24" cy="7" rx="6.4" ry="7.4" fill="${INK}"/><ellipse cx="24" cy="7" rx="6.4" ry="7.4" fill="${INK}"/>
    <circle cx="-21.6" cy="4" r="2.5" fill="#fff"/><circle cx="26.4" cy="4" r="2.5" fill="#fff"/><circle cx="-26" cy="10.4" r="1.3" fill="#fff"/><circle cx="22" cy="10.4" r="1.3" fill="#fff"/>
    ${ln('M-6 23Q0 17.5 6 23', 2.8)}<g transform="translate(-33 22)"><path d="${DROP}" fill="#A6D8FF" stroke="${INK}" stroke-width="1.8"/></g>`,
  thunder: `${ln('M-34-8L-16-1M34-8L16-1', 3.9)}
    <ellipse cx="-24" cy="7" rx="5.6" ry="6" fill="${INK}"/><ellipse cx="24" cy="7" rx="5.6" ry="6" fill="${INK}"/>
    <circle cx="-22.4" cy="5" r="1.8" fill="#fff"/><circle cx="25.6" cy="5" r="1.8" fill="#fff"/>
    <rect x="-10" y="16" width="20" height="9.5" rx="3.6" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
    <path d="M-9 20.75H9M-3.4 16.5V24.6M3.4 16.5V24.6" fill="none" stroke="${INK}" stroke-width="1.5"/>${blush(42, 17, 8, 5, '#FF5E5E', 0.55)}`,
};

const PROPS = {
  rainbow: `<path d="M-80 16Q-100 8-113-14" fill="none" stroke="${INK}" stroke-width="15.5" stroke-linecap="round"/><path d="M-80 16Q-100 8-113-14" fill="none" stroke="#fff" stroke-width="9.4" stroke-linecap="round"/>
    <path d="M80 16Q100 8 113-14" fill="none" stroke="${INK}" stroke-width="15.5" stroke-linecap="round"/><path d="M80 16Q100 8 113-14" fill="none" stroke="#fff" stroke-width="9.4" stroke-linecap="round"/>`,
};
const OVER = {
  snow: `<path d="M44 34C46 44 47 52 49 60" fill="none" stroke="${INK}" stroke-width="14.5" stroke-linecap="round"/><path d="M44 34C46 44 47 52 49 60" fill="none" stroke="#FF9C9F" stroke-width="9" stroke-linecap="round"/>
    <path d="M-80 26C-40 41 40 41 80 26" fill="none" stroke="${INK}" stroke-width="14.5" stroke-linecap="round"/><path d="M-80 26C-40 41 40 41 80 26" fill="none" stroke="#FF9C9F" stroke-width="9" stroke-linecap="round"/>
    <path d="M-80 26C-40 41 40 41 80 26" fill="none" stroke="#fff" stroke-width="9" stroke-dasharray="3 7" opacity=".6"/>`,
  thunder: `<g transform="translate(60 -45)" fill="none" stroke="#FF5A5A" stroke-width="3.6" stroke-linecap="round"><path d="M-9-3Q-3-3-3-9M3-9Q3-3 9-3M9 3Q3 3 3 9M-3 9Q-3 3-9 3"/></g>`,
  cloudy: `<g transform="translate(74 -62)" fill="${INK}"><circle r="3.6"/><circle cx="12" cy="-3" r="3.6"/><circle cx="24" cy="-6" r="3.6"/></g>`,
  initial: `<g transform="translate(86 -42)"><path d="M-7-9C-7-19 8-19 8-9 8-3 1-2 1 5" fill="none" stroke="#FF8B6D" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="1" cy="13.5" r="3" fill="#FF8B6D"/></g>`,
};

let uid = 0;
/** 몽글이 한 마리 (원점 = 몸 가운데) */
export function friendG(w, c = SCN[w] || SCN.initial) {
  const id = `fc${++uid}`;
  return `<defs><clipPath id="${id}"><path d="${CB}"/></clipPath></defs>
    ${PROPS[w] || ''}
    <path d="${CB}" fill="${c.shade}"/>
    <g clip-path="url(#${id})"><path d="${CB}" fill="${c.body}" transform="translate(-7 -10)"/>
      <path d="M-66-10C-68-22-58-32-47-31" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/></g>
    <path d="${CB}" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
    ${FACE[w] || FACE.initial}${OVER[w] || ''}`;
}

/** 몽글이만 (아이콘·배너용), 정사각 viewBox */
export function friendSVG(w, size = 120) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-124 -86 248 160" width="${size}" height="${Math.round(size * 160 / 248)}" aria-hidden="true">${friendG(w)}</svg>`;
}

function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/** 장면 전체 (viewBox 350×300). opts.width/height로 크기, opts.rounded로 모서리 */
/**
 * 장면 전체. ratio(가로/세로)를 주면 세계를 옆으로 넓혀 그 비율에 맞춘다(해·몽글이·언덕이 잘리지 않게).
 * 높이 기준 영역은 y top(기본 30)~300.
 */
export function sceneSVG(w = 'initial', { width = null, height = null, rounded = 0, ratio = null, top = 30, id = `s${++uid}` } = {}) {
  let vb = [0, 0, 350, 300];
  if (ratio) {
    const h = 300 - top;
    if (ratio >= 350 / h) vb = [175 - (h / 2) * ratio, top, h * ratio, h];
    else vb = [0, 300 - 350 / ratio, 350, 350 / ratio];
  }
  const c = SCN[w] || SCN.initial;
  const sky = SKY[w] || SKY.initial;
  const parts = [];
  parts.push(`<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".54" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>
    <radialGradient id="${id}sg"><stop offset="0" stop-color="#FFF8D6" stop-opacity=".95"/><stop offset=".5" stop-color="#FFF3C4" stop-opacity=".5"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></radialGradient>
    ${rounded ? `<clipPath id="${id}r"><rect width="350" height="300" rx="${rounded}"/></clipPath>` : ''}</defs>`);
  parts.push(`<g ${rounded ? `clip-path="url(#${id}r)"` : ''}>`);
  parts.push(`<rect x="-500" y="-400" width="1350" height="720" fill="url(#${id}g)"/>`);
  if (w === 'initial') {
    parts.push(`<path transform="translate(70 50) rotate(-20)" d="M0-14A14 14 0 0 0 0 14A18 18 0 0 1 0-14Z" fill="#FFF6DC"/>`);
    [[30, 30, 0.5], [118, 86, 0.34], [206, 34, 0.42], [296, 58, 0.6], [326, 128, 0.36]].forEach(([x, y, s]) =>
      parts.push(`<path d="${SPARK}" fill="#FFF8DF" transform="translate(${x} ${y}) scale(${s})"/>`));
  }
  // 배경 구름
  parts.push(`<g opacity="${c.bgco}">
    <g transform="translate(60 56) scale(.7)">${PUFF(c.bgc)}</g>
    <g transform="translate(300 106) scale(.95)">${PUFF(c.bgc)}</g>
    <g transform="translate(205 28) scale(.5)">${PUFF(c.bgc)}</g>
    <g transform="translate(-70 120) scale(.8)">${PUFF(c.bgc)}</g><g transform="translate(430 70) scale(.75)">${PUFF(c.bgc)}</g></g>`);
  if (w === 'cloudy') {
    parts.push(`<g transform="translate(38 176) scale(1.3)">${PUFF('#EEEEF5')}</g><g transform="translate(322 150) scale(1.15)">${PUFF('#EEEEF5')}</g><g transform="translate(262 52) scale(.8)">${PUFF('#E3E5EF')}</g>`);
  }
  if (w === 'sunny') {
    const rays = Array.from({ length: 10 }, (_, i) => `<path d="M0-57V-70" transform="rotate(${i * 36})"/>`).join('');
    parts.push(`<g transform="translate(254 100)"><circle r="98" fill="url(#${id}sg)"/>
      <g stroke-linecap="round"><g stroke="${INK}" stroke-width="13">${rays}</g><g stroke="#FFC34F" stroke-width="7.4">${rays}</g></g>
      <circle r="45" fill="#FFC651"/><circle cx="-5" cy="-7" r="41" fill="#FFD86C"/><circle r="45" fill="none" stroke="${INK}" stroke-width="3.2"/>
      <ellipse cx="-21" cy="-25" rx="10" ry="5.6" fill="#FFF3C6" transform="rotate(-35 -21 -25)"/>
      <ellipse cx="-16" cy="1" rx="5.6" ry="6.6" fill="${INK}"/><ellipse cx="16" cy="1" rx="5.6" ry="6.6" fill="${INK}"/>
      <circle cx="-14" cy="-1.6" r="2.1" fill="#fff"/><circle cx="18" cy="-1.6" r="2.1" fill="#fff"/>
      ${mo('M-9 11C-9 22 9 22 9 11Z')}<path d="M-5 16.6C-2 14.4 2 14.4 5 16.6 3 19.6-3 19.6-5 16.6Z" fill="#FF8E86"/>
      ${blush(29, 12, 7, 4.4)}</g>`);
  }
  if (w === 'rainbow') {
    const bands = [[155, '#FF97A5'], [142, '#FFBD82'], [129, '#FFE287'], [116, '#9ADDB2'], [103, '#8EC7F2'], [90, '#BDA6F1']];
    parts.push(`<path d="M13.2 266A161.8 161.8 0 0 1 336.8 266" fill="none" stroke="${INK}" stroke-width="2.6"/>`);
    bands.forEach(([r, col]) => parts.push(`<path d="M${175 - r} 266A${r} ${r} 0 0 1 ${175 + r} 266" fill="none" stroke="${col}" stroke-width="13.6"/>`));
    parts.push(`<path d="M91.8 266A83.2 83.2 0 0 1 258.2 266" fill="none" stroke="${INK}" stroke-width="2.6"/>`);
  }
  if (w === 'rain') {
    const r = rng(7);
    for (let i = 0; i < 26; i++) {
      const x = 108 + (i / 26) * 144 + r() * 8;
      const y = 150 + r() * 120;
      parts.push(`<path d="${DROP}" fill="#DDEBFF" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.7 + r() * 0.3).toFixed(2)})"/>`);
    }
  }
  if (w === 'thunder') {
    parts.push(`<path d="M12 0L-8 34H5L-6 66L24 24H10L20 0Z" transform="translate(144 136)" fill="#FFE36A" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`);
    parts.push(`<path d="M12 0L-8 34H5L-6 66L24 24H10L20 0Z" transform="translate(228 146) scale(.62)" fill="#FFE36A" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`);
  }
  // 뒤 언덕
  parts.push(`<path d="M-200 238C-110 216-20 214 60 228C130 240 200 206 290 212C380 218 460 232 550 222V330H-200Z" fill="${c.hb}" stroke="${c.hs}" stroke-width="2"/>`);
  // 몽글이
  parts.push(`<g transform="translate(${c.fx} ${c.fy}) scale(${c.fs})">${friendG(w, c)}</g>`);
  // 앞 언덕
  parts.push(`<path d="M-200 266C-90 246 40 246 130 254C200 260 250 244 330 248C420 252 480 262 550 256V330H-200Z" fill="${c.hf}" stroke="${c.hs}" stroke-width="2"/>`);
  if (['initial', 'sunny', 'rainbow', 'cloudy'].includes(w)) {
    parts.push(`<path d="M18 272l3-6 2 5 3-7 2 8M190 272l3-6 2 5 3-7 2 8M316 264l3-6 2 5 3-7 2 8" fill="none" stroke="rgba(66,112,64,.32)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (w === 'sunny' || w === 'rainbow') {
    [[34, 266, '#FF9FB4', 1, 11], [62, 274, '#FFFFFF', 0.85, 9], [250, 268, '#FFFFFF', 0.8, 9], [286, 262, '#FFB98A', 1, 11], [318, 270, '#FF9FB4', 0.85, 9]].forEach(([x, y, f, s, h]) =>
      parts.push(`<g transform="translate(${x} ${y})"><path d="M0 0V-${h}" stroke="#6EAE69" stroke-width="2.4" stroke-linecap="round"/><g transform="translate(0 -${h + 3}) scale(${s})" fill="${f}">${FLOWER}</g><circle cy="-${h + 3}" r="2.8" fill="#FFD25E"/></g>`));
  }
  if (w === 'rain') {
    parts.push(`<ellipse cx="84" cy="263" rx="25" ry="5.2" fill="#A3B9DB" stroke="rgba(70,90,130,.25)" stroke-width="1.5"/><ellipse cx="268" cy="258" rx="19" ry="4.2" fill="#A3B9DB" stroke="rgba(70,90,130,.25)" stroke-width="1.5"/>`);
  }
  if (w === 'snow') {
    parts.push(`<g transform="translate(300 266)"><path d="M-11-15l-9-6M11-15l9-7" fill="none" stroke="#8A6A55" stroke-width="2.2" stroke-linecap="round"/>
      <circle cy="-11" r="12" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cy="-29" r="8.6" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
      <circle cx="-3" cy="-30.5" r="1.4" fill="${INK}"/><circle cx="3.2" cy="-30.5" r="1.4" fill="${INK}"/><path d="M0-28l6.5 1.8-6.5 1.6z" fill="#FF9A5C"/>
      <path d="M-7.5-22q7.5 4 15 0" fill="none" stroke="#FF9C9F" stroke-width="3.6" stroke-linecap="round"/></g>`);
    const r = rng(11);
    for (let i = 0; i < 40; i++) {
      const x = -160 + (i / 40) * 670 + r() * 14;
      const y = r() * 280;
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.8 + r() * 2.4).toFixed(1)}" fill="#fff" stroke="rgba(126,146,204,.35)" stroke-width=".8"/>`);
    }
  }
  if (w === 'rainbow') {
    [[56, 120, 0.85], [298, 112, 0.75], [320, 186, 0.55], [30, 192, 0.55], [236, 64, 0.6], [116, 68, 0.5]].forEach(([x, y, s]) =>
      parts.push(`<path d="${SPARK}" fill="#FFF4B8" stroke="${INK}" stroke-width="2" transform="translate(${x} ${y}) scale(${s})"/>`));
  }
  parts.push('</g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map((v) => +v.toFixed(2)).join(' ')}" ${width ? `width="${width}" height="${height}"` : ''} preserveAspectRatio="xMidYMid slice" aria-hidden="true">${parts.join('')}</svg>`;
}
