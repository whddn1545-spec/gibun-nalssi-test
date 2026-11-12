// 시험 고리(?now ?time ?reset ?qa ?nosw)는 시험 서버(tools/serve.py --qa)가 index.html에 넣어 주는 <meta name="kn-qa" content="1">가 있을 때만 켠다.
// 기본 서버(5302)와 배포본의 index.html에는 이 표시가 없으므로, 주소에 무엇을 붙여도 아무 일도 일어나지 않는다(링크로 기록을 지우거나 날짜를 바꿀 수 없음).
export const QA = !!document.querySelector('meta[name="kn-qa"][content="1"]');
const P = new URLSearchParams(QA ? location.search : '');
export const qaParam = (k) => P.get(k); // 시험 모드가 아니면 늘 null
export const qaHas = (k) => P.has(k);   // 시험 모드가 아니면 늘 false
