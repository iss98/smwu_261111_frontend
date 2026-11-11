# 웹 실행과 배포

JavaScript와 Vite로 만든 정적 프론트엔드입니다.

1. `npm install`을 실행합니다.
2. `.env.example`을 `.env`로 복사하고 FastAPI 주소를 입력합니다.
3. `npm run dev`로 개발 서버를 실행합니다.
4. `npm run build`로 정적 파일을 생성합니다.

이메일 확인 링크는 FastAPI가 Gmail MCP를 통해 발송합니다. 브라우저는 링크를 확인한 뒤 FastAPI가 발급한 세션 토큰으로 API를 호출합니다. Firebase SDK와 Firestore 연결 정보는 프론트엔드에 포함하지 않습니다.

이 폴더를 독립 저장소로 배포할 때 Netlify에서는 기본 디렉터리를 저장소 루트로 두고, 빌드 명령을 `npm run build`, 게시 디렉터리를 `dist`로 설정합니다. `VITE_API_BASE_URL`에는 배포된 FastAPI의 HTTPS 주소를 지정합니다. `VITE_*` 값은 브라우저에 공개되므로 비밀키를 넣지 않습니다.
