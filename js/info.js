// 설정 → 정보 시트에 보여 주는 글. site/의 공개 페이지와 같은 내용이다(바꾸면 함께 바꾼다).
import { LINKS, SUPPORT_EMAIL, APP, DEVELOPER } from './config.js';
import { platform } from './native.js';

const EFFECTIVE = '2026년 11월 21일';

/** 휴대폰 기본 백업 안내: 아이폰 앱에서는 아이폰 이야기만, 안드로이드에서는 안드로이드 이야기만 */
function osBackup() {
  const p = platform();
  const who = p === 'ios' ? 'iCloud 백업' : p === 'android' ? 'Google 백업' : '휴대폰 기본 백업';
  const by = p === 'ios' ? 'Apple' : p === 'android' ? 'Google' : '운영체제 제공 회사';
  return `휴대폰의 ${who}을 켜 두었다면 운영체제가 다른 앱 데이터와 함께 이 기록을 사용자 본인의 계정에 백업할 수 있습니다. 이 백업은 ${by}가 사용자 계정으로 관리하며, 개발자는 볼 수 없습니다.`;
}

const linkRow = (url, label) => (url ? `<p class="info-link"><a href="${url}" data-ext>${label} ›</a></p>` : '');

export const INFO = {
  privacy: {
    kicker: `시행일 ${EFFECTIVE}`,
    title: '개인정보처리방침',
    html: () => `
      <p class="info-lead">기분날씨는 <b>개인정보를 수집하지 않습니다.</b> 회원가입·로그인이 없고, 광고·분석 도구도 쓰지 않습니다.</p>
      <h3>1. 기록은 어디에 저장되나요</h3>
      <p>고른 날씨, 한 줄 메모, 마음 단어, 설정은 <b>이 휴대폰 안에만</b> 저장됩니다. 개발자를 포함해 누구에게도 전송되지 않으며, 인터넷 연결 없이도 동작합니다.</p>
      <p>${osBackup()}</p>
      <h3>2. 수집·이용·제3자 제공</h3>
      <p>이름, 연락처, 위치, 기기 식별자, 사용 기록 등 어떤 정보도 수집하거나 제3자에게 제공하지 않습니다.</p>
      <h3>3. 백업과 공유</h3>
      <p>'기록 백업하기'나 '공유하기'를 직접 누를 때만 파일·이미지가 만들어지고, 어디로 보낼지는 사용자가 고릅니다. 그 뒤의 처리는 사용자가 고른 앱의 정책을 따릅니다.</p>
      <h3>4. 사용하는 권한 (모두 선택)</h3>
      <p>아래 권한은 허용하지 않아도 기록·달력·예보 등 다른 기능을 모두 쓸 수 있습니다.</p>
      <ul><li><b>알림</b>: 매일 알림을 켠 경우에만, 정한 시각에 이 휴대폰 안에서 알림을 띄웁니다.</li>
      <li><b>사진 추가</b>(아이폰): 카드 이미지를 사진 앱에 저장할 때만 씁니다. 사진을 읽지 않습니다.</li>
      <li><b>저장 공간</b>(안드로이드 9 이하): 카드 이미지를 '사진'에 저장할 때만 묻습니다. 안드로이드 10 이상에서는 묻지 않습니다.</li></ul>
      <h3>5. 기록 지우기</h3>
      <p>설정 → '모든 기록 지우기'를 누르거나 앱을 삭제하면 이 휴대폰의 기록이 모두 지워집니다. 지운 기록은 되살릴 수 없으니 필요하면 먼저 백업해 주세요.</p>
      <h3>6. 아동의 개인정보</h3>
      <p>어떤 연령의 개인정보도 수집하지 않습니다.</p>
      <h3>7. 바뀌는 경우</h3>
      <p>이 방침이 바뀌면 앱 업데이트와 함께 이 화면에 알립니다.</p>
      <h3>8. 운영자와 문의</h3>
      <p>운영: ${DEVELOPER || '기분날씨 개발자'}${SUPPORT_EMAIL ? ` · 문의: <a href="mailto:${SUPPORT_EMAIL}" data-ext>${SUPPORT_EMAIL}</a>` : ''}</p>
      ${linkRow(LINKS.privacy, '웹에서 보기')}`,
  },
  help: {
    kicker: '자주 묻는 질문',
    title: '도움말 · 문의',
    html: () => `
      <h3>기록은 어디에 저장되나요?</h3>
      <p>이 휴대폰에만 저장돼요. 휴대폰을 바꿀 때는 설정 → <b>기록 백업하기</b>로 파일을 만들어 두고, 새 휴대폰에서 <b>백업 불러오기</b>로 되살려요. (휴대폰 기본 백업으로 옮겨질 때도 있지만, 파일 백업이 가장 확실해요.)</p>
      <h3>지난 날을 깜빡했어요</h3>
      <p>달력에서 그 날짜를 누르면 그날의 날씨와 메모를 남길 수 있어요. 미래 날짜는 남길 수 없어요.</p>
      <h3>마음 단어는 뭔가요?</h3>
      <p>날씨를 고른 뒤, 그날 마음에 가까운 말을 3개까지 고를 수 있어요. 안 골라도 괜찮아요. 고른 단어는 달력의 '돌아보기'에 모여요.</p>
      <h3>몽글이 소품은 어떻게 열리나요?</h3>
      <p>기록한 날이 1·3·7·10·14·21·30·50일이 될 때마다 하나씩 열려요. 연속이 아니어도 괜찮아요.</p>
      <h3>마음 일기예보는 언제 오나요?</h3>
      <p>매주 월요일, 지난주 기록으로 만든 예보 카드가 도착해요. 예보 탭에서 이번 주 카드도 언제든 볼 수 있어요.</p>
      <h3>알림이 오지 않아요</h3>
      <p>설정 → <b>매일 알림</b>을 켜고, 휴대폰 설정에서 기분날씨 알림이 허용돼 있는지 확인해 주세요. 그날 이미 기록했다면 알림을 보내지 않아요.</p>
      <h3>마음이 많이 힘들 때</h3>
      <p>기분날씨는 치료를 대신하지 않아요. 힘든 날이 이어진다면 가까운 사람이나 전문가와 이야기해 주세요. 24시간 <b>자살예방상담전화 109</b>, <b>정신건강위기상담전화 1577-0199</b>에서 도움을 받을 수 있어요.</p>
      ${SUPPORT_EMAIL ? `<h3>문의하기</h3><p>궁금한 점이나 불편한 점은 <a href="mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[기분날씨 ${APP.version}] 문의`)}" data-ext>${SUPPORT_EMAIL}</a>로 보내 주세요.</p>` : ''}
      ${linkRow(LINKS.support, '지원 페이지 열기')}`,
  },
  licenses: {
    kicker: '이 앱에 쓰인 오픈소스',
    title: '오픈소스 라이선스',
    html: () => `
      <h3>Pretendard</h3>
      <p>Copyright (c) 2021, Kil Hyung-jin (https://github.com/orioncactus/pretendard), with Reserved Font Name Pretendard.<br>SIL Open Font License 1.1에 따라 씁니다.</p>
      <pre class="info-pre" id="license-ofl">불러오는 중…</pre>
      <h3>Capacitor 및 공식 플러그인</h3>
      <p>Copyright (c) 2017-present Drifty Co. — MIT License</p>
      <h3>@capacitor-community/media (아이폰)</h3>
      <p>Copyright (c) Capacitor Community — MIT License. 함께 쓰는 SDWebImage — MIT License.</p>
      <h3>ion-filesystem</h3>
      <p>Copyright (c) Ionic — MIT License</p>
      <h3>Apache Cordova, AndroidX (안드로이드)</h3>
      <p>Apache License 2.0 — https://www.apache.org/licenses/LICENSE-2.0</p>
      <pre class="info-pre">Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</pre>`,
  },
};
