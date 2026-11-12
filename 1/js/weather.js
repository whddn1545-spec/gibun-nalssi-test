// 날씨 8종의 이름·감정·색·문구. 앱의 모든 화면이 이 정의를 함께 쓴다.

export const WEATHERS = [
  {
    id: 'rainbow', name: '무지개', feel: '최고예요', temp: 28,
    flower: '#FF8FB1',
    tile: ['#58B2F7', '#A9DCFA', '#FFE1EA'],
    placeholder: '어떤 일이 이렇게 좋았어요?',
    comments: [
      '두고두고 꺼내 볼 하루가 생겼네요.',
      '하늘이 먼저 축하해 주는 날이에요.',
      '이런 날이 있어서 또 힘이 나죠.',
      '오늘의 기분, 꼭 기억해 둘게요.',
      '마음에 일곱 빛깔이 다 떴어요.',
    ],
  },
  {
    id: 'clear', name: '맑음', feel: '좋아요', temp: 24,
    flower: '#FFD25E',
    tile: ['#3F9BF2', '#8FD0FA', '#FFEFD0'],
    placeholder: '오늘 뭐가 좋았어요?',
    comments: [
      '마음에 볕이 잘 드는 날이네요.',
      '오늘 같은 날은 천천히 걸어도 좋아요.',
      '이 햇살, 내일 몫까지 쬐어 둬요.',
      '좋은 날은 적어 두면 두 번 좋아요.',
      '구름 한 점 없이 괜찮은 하루예요.',
    ],
  },
  {
    id: 'cloud', name: '구름', feel: '그럭저럭', temp: 15,
    flower: '#F4F1EA',
    tile: ['#8FA8C4', '#BCCCDD', '#EAE8E2'],
    placeholder: '오늘을 한 줄로 남겨 볼까요?',
    comments: [
      '흐린 날엔 눈이 덜 부셔서 좋아요.',
      '그럭저럭도 충분히 괜찮은 하루예요.',
      '해는 구름 뒤에서 잠깐 쉬는 중이에요.',
      '별일 없는 날이 제일 귀할 때도 있어요.',
      '오늘은 딱 이만큼이면 됐어요.',
    ],
  },
  {
    id: 'snow', name: '눈', feel: '고요해요', temp: 16,
    flower: '#FFFFFF',
    tile: ['#9DB6DA', '#C9D8EE', '#F4F3F6'],
    placeholder: '지금 어떤 생각을 하고 있어요?',
    comments: [
      '오늘 마음은 소리 없이 쌓이네요.',
      '고요한 것도 큰 힘이에요.',
      '따뜻한 거 하나 챙겨 드세요.',
      '눈 오는 날엔 세상이 잠깐 조용해져요.',
      '조용히 있고 싶은 날도 있어요.',
    ],
  },
  {
    id: 'wind', name: '바람', feel: '분주해요', temp: 13,
    flower: '#8FE0D6',
    tile: ['#62AEDC', '#A9D8EA', '#EFF3E2'],
    placeholder: '무엇이 마음을 바쁘게 했어요?',
    comments: [
      '마음이 조금 바쁜 날이네요.',
      '바람 부는 날엔 꽉 쥐지 않아도 돼요.',
      '오늘 일은 바람한테 조금 맡겨요.',
      '잠깐 멈추면 바람도 잦아들어요.',
      '분주했던 만큼 저녁은 느긋하게요.',
    ],
  },
  {
    id: 'fog', name: '안개', feel: '멍해요', temp: 10,
    flower: '#CFC9E8',
    tile: ['#ABB7C1', '#CDD5DA', '#EDEDE8'],
    placeholder: '머릿속에 뭐가 떠다니나요?',
    comments: [
      '안개는 해가 뜨면 걷혀요.',
      '오늘은 멀리 안 보여도 괜찮아요.',
      '한 걸음 앞만 보여도 충분해요.',
      '멍한 날은 마음이 쉬고 있다는 뜻이에요.',
      '천천히 가요, 길은 어디 안 가요.',
    ],
  },
  {
    id: 'rain', name: '비', feel: '울적해요', temp: 7,
    flower: '#6FB2FF',
    tile: ['#46607F', '#6E88A5', '#A9B7C6'],
    placeholder: '무슨 일이 있었어요?',
    comments: [
      '비 오는 날은 좀 쉬어도 돼요.',
      '이 비도 언덕의 꽃에겐 물이 될 거예요.',
      '오늘은 창가에 앉아 있어도 돼요.',
      '울적한 날도 하늘의 한 부분이에요.',
      '그치지 않는 비는 없대요.',
    ],
  },
  {
    id: 'thunder', name: '천둥', feel: '화나요', temp: 4,
    flower: '#B08CFF',
    tile: ['#29254D', '#4A4170', '#7D6C92'],
    placeholder: '누가 그랬어요? 여기에만 말해요.',
    comments: [
      '화가 날 만한 일이었을 거예요.',
      '천둥은 오래 머물지 못해요.',
      '실컷 울리고 나면 공기가 맑아져요.',
      '참지 말고 여기에 쏟아 놔요.',
      '폭풍이 지나가도 이 언덕은 그대로예요.',
    ],
  },
];

export const W = Object.fromEntries(WEATHERS.map((w) => [w.id, w]));
export const isWeather = (id) => Object.prototype.hasOwnProperty.call(W, id);

export const tileGradient = (id) => {
  const t = W[id].tile;
  return `linear-gradient(180deg, ${t[0]} 0%, ${t[1]} 62%, ${t[2]} 100%)`;
};

// 앱 전체 배경: [위, 아래]. 어두운 날씨는 낮에도 어두운 테마로 바뀐다.
export const AMBIENT = {
  none: { day: ['#DCEEFC', '#FBF3E6'], night: ['#0F1636', '#262E5C'] },
  clear: { day: ['#CFE8FF', '#FFF2DC'], night: ['#0E1638', '#27326A'] },
  rainbow: { day: ['#D8EBFF', '#FFE9F1'], night: ['#12163D', '#32316C'] },
  cloud: { day: ['#DAE2EB', '#F2EFE9'], night: ['#151B33', '#2C3354'] },
  snow: { day: ['#DFE8F6', '#F8F5F7'], night: ['#141C3A', '#303C63'] },
  wind: { day: ['#D3E9F3', '#F2F6E6'], night: ['#101A38', '#28385A'] },
  fog: { day: ['#DFE3E7', '#F1EFEA'], night: ['#1A2031', '#343C4E'] },
  rain: { day: ['#26394F', '#435970'], night: ['#0F1728', '#243247'], dark: true },
  thunder: { day: ['#191632', '#352D5B'], night: ['#0B0A1E', '#241E40'], dark: true },
};
