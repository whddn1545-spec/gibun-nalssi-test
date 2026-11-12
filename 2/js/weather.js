// 날씨 정의와 문구. 화면에 나오는 날씨 이름과 말투의 단일 출처다.

export const WEATHER_IDS = ['sunny', 'cloudy', 'rain', 'thunder', 'snow', 'rainbow'];

export const WEATHERS = {
  sunny: {
    id: 'sunny',
    name: '맑음',
    mood: '기분 좋아요',
    score: 4,
    color: '#ffb547',
    lines: [
      '구름 한 점 없이 맑은 마음이에요.',
      '오늘 마음엔 볕이 잘 들어요.',
      '이 볕, 오래 쬐고 가요.',
      '빨래 널기 딱 좋은 기분이네요.',
      '마음이 보송보송하게 말랐어요.',
    ],
  },
  cloudy: {
    id: 'cloudy',
    name: '구름',
    mood: '그저 그래요',
    score: 3,
    color: '#a9b9cf',
    lines: [
      '해는 잠깐 구름 뒤에 있어요.',
      '맑지도 흐리지도 않은, 그런 날이에요.',
      '구름도 가끔은 쉬어 가요.',
      '조금 흐려도 하늘은 그대로예요.',
      '천천히 흘러가면 돼요.',
    ],
  },
  rain: {
    id: 'rain',
    name: '비',
    mood: '울적해요',
    score: 2,
    color: '#5b92f0',
    lines: [
      '비 오는 날엔 마음도 조금 젖어요.',
      '괜찮아요. 비는 그치게 되어 있어요.',
      '오늘은 우산 아래서 쉬어요.',
      '실컷 내리고 나면 공기가 맑아져요.',
      '젖은 채로 있어도 괜찮은 날이에요.',
    ],
  },
  thunder: {
    id: 'thunder',
    name: '천둥',
    mood: '화가 나요',
    score: 1,
    color: '#8a68e0',
    lines: [
      '우르릉, 참느라 고생했어요.',
      '오늘은 번개 좀 쳐도 돼요.',
      '마음이 크게 울린 날이네요.',
      '천둥은 지나가요. 곧 조용해질 거예요.',
      '화나는 건 화나는 거예요.',
    ],
  },
  snow: {
    id: 'snow',
    name: '눈',
    mood: '차분해요',
    score: 3,
    color: '#bfe6f7',
    lines: [
      '소리 없이 마음이 쌓이는 날이에요.',
      '세상이 잠깐 조용해졌어요.',
      '하얗게 덮어 두고 쉬어요.',
      '차분하게, 천천히 내려요.',
      '오늘은 고요함이 필요한 날이에요.',
    ],
  },
  rainbow: {
    id: 'rainbow',
    name: '무지개',
    mood: '최고예요',
    score: 5,
    color: '#ff86b4',
    lines: [
      '오늘, 마음에 무지개가 떴어요!',
      '이런 날은 꼭 적어 둬야 해요.',
      '비 온 뒤라 더 예쁜 거예요.',
      '잘 넣어 뒀다가 힘든 날 꺼내 봐요.',
      '오늘의 나, 아주 근사해요.',
    ],
  },
};

export const iconURL = (id) => `assets/weather/${id}.svg`;

export const isWeather = (id) => Object.prototype.hasOwnProperty.call(WEATHERS, id);

// 같은 날에는 언제 열어도 같은 문장이 나오도록 날짜로 고른다.
export function lineFor(id, dateStr) {
  const list = WEATHERS[id].lines;
  let hash = 0;
  for (const ch of `${id}${dateStr}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return list[hash % list.length];
}
