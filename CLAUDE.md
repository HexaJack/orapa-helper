# Orapa Space Helper - 개발 컨텍스트

## 핵심 파일

- `src/game/laser.ts` (567줄) - 가장 복잡한 파일. 레이저 반사 시뮬레이션 전체 로직
- `src/game/board.ts` (403줄) - 보드 생성, 배치 검증, 인접 판정
- `src/hooks/use-game.ts` (212줄) - 게임 전체 상태 관리
- `src/components/game-board.tsx` (392줄) - 메인 UI + 드래그

## 레이저 반사 규칙 (laser.ts)

### 거울 유형
각 셀의 대각선 면은 `/` 또는 `\` 거울로 동작:
- **`/` 거울**: right→up, down→left, left→down, up→right
- **`\` 거울**: right→down, up→left, left→up, down→right

### 행성별 반사

**다이아몬드 (2x2, 빨강/파랑)**
```
[0,0](/) [0,1](\)
[1,0](\) [1,1](/)
```
- 외부에서 진입하는 방향만 반사, 내부→내부는 `pass`
- (0,0): right→up, down→left / (0,1): left→up, down→right
- (1,0): right→down, up→left / (1,1): left→down, up→right

**팔각형 (3x3, 노랑)**
- 4귀퉁이만 다이아몬드와 동일한 직각 반사
- 나머지 셀(변+중앙)은 정면 반사 (reverseDirection)

**반팔각형 (4x2, 큰 흰색)**
- `edgeSide`로 직선 부분 방향 결정 (top/bottom/left/right)
- 곡면 쪽 양 끝 귀퉁이만 직각 반사
- 직선 쪽 + 중간 셀은 정면 반사

**토성 (4x2, 흰색 고리)**
```
horizontal: [고리] [원] [원] [고리]
```
- **원 부분 (중앙 2x2)**: 다이아몬드와 동일한 직각 반사
- **고리 부분 (양 끝)**: 수직→정면 반사, 수평→통과(pass)
- vertical일 때는 축 회전 (수평↔수직 반전)

**블랙홀 (1x1)**
- 직접 충돌: 소멸 (exitPoint='소멸')
- 인접 통과: 지나간 후 꺾임 (pending refraction)
  - 현재 칸에서 블랙홀 감지 → 다음 칸으로 이동 후 방향 변경
  - 같은 블랙홀에 대해 1회만 굴절

### 색상 혼합
- 1색: 해당 색 그대로
- 2색: 빨+노=주황, 빨+파=보라, 노+파=초록
- 흰색 혼합: 빨+흰=핑크, 노+흰=레몬, 파+흰=하늘
- 3색+: 빨+노+흰=연주황, 빨+파+흰=연보라, 노+파+흰=연초록
- 빨+노+파=검정, 빨+노+파+흰=회색

## 인접 배치 규칙 (board.ts)

`getPhysicalCells()` 함수가 인접 판정용 셀을 반환. 겹침은 전체 셀로 체크.

**면 접촉만 인접으로 판정. 대각선/꼭짓점 접촉은 허용:**
- **다이아몬드**: 물리적 셀 = 빈 배열 (모든 셀이 대각선이라 인접 판정 없음)
- **토성**: 고리 제외, 중앙 2x2만
- **대형 흰색**: `edgeSide` 기반으로 잘린 모서리 2칸 제외
- **나머지**: 전체 셀

## 난이도 공식 (difficulty.ts)

```
기본 5점에서:
- 빈라인 비율 × 5 (감점)
- 인접탈출 비율 × 3 (감점)
- 정보 유일성: (uniqueRatio - 0.5) × 3 (유일하면 감점, 중복이면 가점)
- 평균 경로길이: (avg - 3) × 0.3 (가점)
- 밀집도: (1 - spread) × 2 (가점)
- 2색 혼합: 종류당 +0.1 (최대 3)
- 3색+ 혼합: 종류당 +0.5
```

난이도 기준: 쉬움 0~3, 보통 3~6, 어려움 6~10
생성 시 최대 200회 시도하여 점수 범위 맞춤.

## 모바일 드래그 (game-board.tsx)

React의 onTouchMove는 passive라 `preventDefault()` 불가.
`useEffect`로 non-passive 리스너 직접 등록:

```
touchstart (passive: true) → 시작점 기록 + 행성 위 터치 감지
touchmove (passive: false) → 거리 > 8px이면 드래그 시작, preventDefault로 스크롤 차단
touchend (passive: true) → 드래그 종료 또는 탭 처리
```

## 파일 명명 규칙

- **kebab-case**: 모든 파일 (macOS 대소문자 비구분 대응)
- 기존 PascalCase 파일(Board.tsx 등)은 완전히 다른 이름으로 변경 (board.tsx가 아닌 game-board.tsx)
- git mv로 2단계 리네임 필요 (Board→board-temp→board)

## 주요 설계 결정

1. **Next.js 대신 Vite+React**: 서버 불필요, 정적 앱이라 SSR 무의미
2. **Capacitor**: WebView 앱 래핑용이지만 현재는 Vercel 배포로 운영
3. **localStorage**: 서버/DB 없이 게임 기록 저장, 앱 삭제 전까지 영구 보존
4. **SVG 행성 에셋**: 드래그 고스트 + 조각 트레이에 사용 (public/planets/)
5. **솔로/멀티 분리**: `isSolo`로 배치 모드 상시 활성/제출 후 활성 구분
6. **정답 보기 비교**: 실제 행성 100% + 배치한 행성 35% 투명도 오버레이

## 온라인 멀티플레이어

Supabase Realtime Broadcast 사용. DB 없음. 상세: `docs/multiplayer.md`

- 호스트 폰 = 게임 서버 (planets 보유, fireLaser 실행)
- 클라이언트 = 요청 전송 + 결과 수신
- 채널 = 방 코드 (6자리)
- 턴제 발사 + 자유 정답 제출 + 2회 오답 탈락
- 기존 솔로/로컬 코드 변경 없음 (App.tsx에서 분기만)
- 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## 알려진 이슈

- 난이도 '어려움' 도달이 기본 모드에서 여전히 드물 수 있음
- 드래그 UX가 PC에서는 양호하지만 모바일에서 정밀도 부족
- 온라인: 호스트 이탈 시 게임 종료, 자동 재접속 미구현
