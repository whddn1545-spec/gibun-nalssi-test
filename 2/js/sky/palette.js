// 날씨별 목표 파라미터와 색. 값의 출처는 docs/SPEC.md 4절.

import { hex } from './util.js';

export const KEYS = ['sun', 'cloud', 'dark', 'rain', 'snow', 'bolt', 'bow', 'snowCover', 'wind'];
// 현재값이 목표를 따라가는 시간 상수(초)
export const TAU = [1.0, 1.2, 1.1, 0.8, 1.0, 0.7, 1.0, 1.4, 1.0];

export const PARAMS = {
  neutral: [0.5, 0.25, 0, 0, 0, 0, 0, 0, 0.15],
  sunny: [1, 0.12, 0, 0, 0, 0, 0, 0, 0.12],
  cloudy: [0.15, 0.75, 0.3, 0, 0, 0, 0, 0, 0.25],
  rain: [0, 0.95, 0.65, 1, 0, 0, 0, 0, 0.45],
  thunder: [0, 1, 1, 0.7, 0, 1, 0, 0, 0.8],
  snow: [0.1, 0.6, 0.12, 0, 1, 0, 0, 1, 0.15],
  // 무지개는 해를 등지고 보이는 것이고, 시간대에 따라 해가 아치와 겹치기도 해서 해를 뺀다.
  rainbow: [0, 0.22, 0, 0, 0, 0, 1, 0, 0.1],
};

const list = (...a) => a.map(hex);

// 낮 위·중간·아래, 밤 위·중간·아래
export const SKY = {
  neutral: list('#5E8FD6', '#A9C6EC', '#F6E2D3', '#141B3F', '#2B3063', '#5A4D82'),
  sunny: list('#1E6FE3', '#4FA4F2', '#FFE2AE', '#0A1238', '#1C2A66', '#4B3F85'),
  cloudy: list('#7488A6', '#A5B5CA', '#E7E4DD', '#141A2C', '#2A3249', '#4A5168'),
  rain: list('#2F3F59', '#4E6380', '#8CA0B5', '#0A111F', '#1B2638', '#324055'),
  thunder: list('#1A1636', '#3A2C62', '#7A5384', '#06050F', '#1B1233', '#3D2552'),
  snow: list('#9DBBDD', '#CFE0F2', '#F7FAFD', '#18264A', '#35496F', '#7487AB'),
  rainbow: list('#2F7BE6', '#6DB7F5', '#FFD9E0', '#15194C', '#33307E', '#8650A0'),
};

// 먼 언덕, 가까운 언덕 위, 가까운 언덕 아래 (낮 기준)
export const HILL = {
  neutral: list('#7FA3B8', '#7DAE9A', '#4F8676'),
  sunny: list('#6FB6A0', '#7CCB7A', '#3F9A63'),
  cloudy: list('#7E97A0', '#7FA28F', '#557A6C'),
  rain: list('#44586B', '#4A7269', '#2E5050'),
  thunder: list('#2C2649', '#33355A', '#1C1C38'),
  snow: list('#D5E3F0', '#F2F7FC', '#C9D9EA'),
  rainbow: list('#86CDB8', '#90DDA0', '#4FB489'),
};

export const NIGHT_MUL = [0.32, 0.38, 0.55];
export const keyOf = (id) => (id && PARAMS[id] ? id : 'neutral');
