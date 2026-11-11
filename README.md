# 웹 실행과 배포

JavaScript와 Vite로 만든 정적 프론트엔드입니다. 이메일 주소나 Gmail 인증 없이 일기를 쓰고, 대화로 내일 할 일을 정해 화면에서 확인합니다.

1. `npm install`을 실행합니다.
2. `.env.example`을 `.env`로 복사하고 FastAPI 주소를 입력합니다.
3. `npm run dev`로 개발 서버를 실행합니다.
4. `npm run build`로 정적 파일을 생성합니다.

브라우저별 방문 토큰과 현재 기록 ID를 `localStorage`에 보관합니다. 같은 브라우저에서 새로고침하면 현재 기록을 다시 열고 이전 기록 목록을 볼 수 있습니다. 브라우저 데이터를 삭제하거나 방문 토큰이 만료되면 이전 기록에 접근할 수 없습니다. Firebase SDK와 Firestore 연결 정보는 프론트엔드에 포함하지 않습니다.

이 폴더를 독립 저장소로 배포할 때 Netlify에서는 기본 디렉터리를 저장소 루트로 두고, 빌드 명령을 `npm run build`, 게시 디렉터리를 `dist`로 설정합니다. `VITE_API_BASE_URL`에는 배포된 FastAPI의 HTTPS 주소를 지정합니다. `VITE_*` 값은 브라우저에 공개되므로 비밀키를 넣지 않습니다.
