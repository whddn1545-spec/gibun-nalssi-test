// 앱: 시작 화면은 첫 화면을 그린 뒤 main.js가 닫는다. 무슨 일이 있어도 4초 뒤에는 닫는다.
// (보안 정책(CSP)이 인라인 스크립트를 막으므로 파일로 둔다)
setTimeout(function () { try { var c = window.Capacitor; if (c && c.Plugins && c.Plugins.SplashScreen) c.Plugins.SplashScreen.hide(); } catch (e) {} }, 4000);
