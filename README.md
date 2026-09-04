# Ebbinghaus

에빙하우스 망각곡선 기반 개인용 간격 반복 암기 시스템. PC와 모바일 브라우저에서 동일하게 쓸 수 있는
정적 PWA이고, GitHub 저장소를 데이터베이스로 삼아 기기 간 동기화한다.

**Live**: https://miel4ru-web.github.io/ebbinghaus/

## 왜 이렇게 만들었는지

계획 전문: [`10-48-binary-honey.md`](https://github.com/miel4ru-web/ebbinghaus/blob/main/docs/plan.md) 참고.
요약하면:

- **스케줄러**는 고정된 에빙하우스 사다리(10분→1시간→1일→2일→…→6개월)를 기본으로 하고, 카드별 `ease`로
  보정한다. FSRS 같은 완전 적응형 모델 대신 이걸 고른 이유는 투명성 — "왜 이 간격이죠?"에 답할 수 있어야
  했다.
- **동기화**는 노트/덱은 단순 업서트, 카드/복습기록은 로그 재생(replay) 방식이다. 스케줄러가 순수 함수이기
  때문에 두 기기의 리뷰 로그를 병합해 처음부터 재생하면 항상 같은 결과가 나온다.
- **데이터는 별도 비공개 저장소**(`ebbinghaus-data`)에 있다. 이 앱 저장소는 공개지만 학습 내용은 아니다.
- **LLM 카드 생성은 BYOK**다. 브라우저에서 사용자의 Anthropic API 키로 직접 호출한다(프록시 서버 없음).

## 로컬 개발

```bash
npm install
npm run dev
npm test
npm run build
```

## 설정

앱의 "설정" 탭에서:
1. GitHub — `ebbinghaus-data` 저장소 하나에만 `contents: write` 권한을 준 fine-grained PAT
2. Anthropic — 카드 자동 생성용 API 키 (선택)

## 기술 스택

Vite · React 19 · TypeScript · Tailwind v4 · IndexedDB(`idb`) · `@anthropic-ai/sdk` · DOMPurify · Vitest
