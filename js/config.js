// 출시할 때 고치는 값을 한 곳에 모았다. (출시안내.md 참고)
export const APP = { version: '1.0.0', build: 1 };

// 공개 주소가 정해지면 넣는다. 비어 있으면 앱 안 화면(정보 시트)만 보여 준다.
export const LINKS = {
  privacy: '', // 예: https://<깃허브아이디>.github.io/gibun-nalssi/privacy.html
  support: '', // 예: https://<깃허브아이디>.github.io/gibun-nalssi/support.html
  store: '', // 앱스토어·플레이 주소. 공유 문구 끝에 붙는다.
};

// 스토어·개인정보처리방침에 보일 운영자 이름(개인 실명 또는 상호). 출시 전에 꼭 채운다.
export const DEVELOPER = '';

// 문의 메일. 비어 있으면 도움말에 메일 버튼을 보이지 않는다. 출시 전에 꼭 채운다(스토어 심사 필수).
export const SUPPORT_EMAIL = '';
