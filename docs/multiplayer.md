# 온라인 멀티플레이어

## 개요

Supabase Realtime Broadcast를 사용한 실시간 멀티플레이어. DB 없이 채널 기반 pub/sub만 사용. 호스트 폰이 게임 서버 역할을 하고, 다른 플레이어는 클라이언트로 접속.

## 플로우

```
1. 메인 화면 → "온라인 플레이" 클릭
2. 이름 입력
3. "방 만들기" 또는 "방 참가" 선택
4. 호스트: 6자리 방 코드 생성 → 대기실 → 2명 이상 시 "게임 시작"
5. 클라이언트: 6자리 코드 입력 → 대기실 → 호스트가 시작할 때까지 대기
6. 게임 진행: 턴제 레이저 발사 + 언제든 정답 제출
7. 정답 맞추면 승리, 2회 오답 시 자동 탈락, 전원 탈락 시 게임 종료
```

## 아키텍처

```
호스트 폰 (use-online-host.ts)
├── 행성 배치 데이터 보유 (planets 배열)
├── fireLaser() 직접 호출하여 결과 계산
├── comparePlacements()로 정답 검증
├── 턴 관리 (currentTurnPlayerId 순환)
├── 탈락 처리 (wrongAnswers >= 2)
└── Broadcast로 결과 전송

클라이언트 폰 (use-online-client.ts)
├── 발사 요청 전송 (fire-request)
├── 정답 제출 전송 (answer-submission)
├── 호스트 브로드캐스트 수신 → UI 업데이트
└── 행성 데이터 접근 불가 (치팅 방지)
```

## 메시지 프로토콜

채널: `supabase.channel(roomCode)` — 방 코드가 채널 이름.

### 호스트 → 전체 (event: 'host-message')

| type | 용도 | 주요 필드 |
|------|------|-----------|
| `room-state` | 전체 상태 동기화 (참가, 시작, 주기적) | `state: RoomState` |
| `shot-result` | 레이저 발사 결과 | `label, result, nextTurnPlayerId` |
| `answer-wrong` | 오답 알림 | `playerId, wrongCount` |
| `answer-correct` | 정답 알림 | `playerId` |
| `player-eliminated` | 탈락 (2회 오답) | `playerId` |
| `game-over` | 게임 종료 | `winnerId` (null이면 전원 탈락) |

### 클라이언트 → 호스트 (event: 'client-message')

| type | 용도 | 주요 필드 |
|------|------|-----------|
| `join-request` | 방 참가 | `playerId, playerName` |
| `fire-request` | 레이저 발사 요청 | `playerId, label` |
| `answer-submission` | 정답 제출 | `playerId, planets[]` |
| `leave` | 퇴장 | `playerId` |

## 상태 (RoomState)

```typescript
{
  roomCode: string          // 6자리 코드
  gameMode: GameMode        // 'basic' | 'blackhole'
  difficulty: number        // 난이도 점수
  players: PlayerInfo[]     // 참가자 목록
  currentTurnPlayerId: string | null
  history: HistoryEntry[]   // 발사 기록 (전체 공유)
  phase: 'lobby' | 'playing' | 'finished'
  winnerId: string | null
  firedLabels: string[]     // 발사된 지점 목록
}
```

## 턴 규칙

- players 배열 순서대로 돌아감
- 탈락(eliminated)된 플레이어는 자동 스킵
- 발사는 자기 턴에만 가능
- 정답 제출은 턴 무관, 언제든 가능
- 이미 발사된 지점은 중복 발사 불가 (전체 공유)

## 탈락 규칙

- 정답 제출 시 틀리면 wrongAnswers +1
- wrongAnswers >= 2 → eliminated = true → 자동 탈락
- 탈락 플레이어는 턴 스킵, 관전만 가능
- 전원 탈락 시 게임 종료 (승자 없음)

## 파일 구조

```
src/
├── game/
│   ├── multiplayer-types.ts  # 메시지/상태 타입 정의
│   └── supabase.ts           # Supabase 클라이언트, 방코드/플레이어ID 생성
├── hooks/
│   ├── use-online-host.ts    # 호스트 훅 (서버 로직)
│   └── use-online-client.ts  # 클라이언트 훅 (요청/수신)
└── components/
    ├── online-lobby.tsx      # 방 생성/참가 + 대기실 UI
    ├── online-lobby.css
    ├── online-game-board.tsx # 온라인 보드 (기존 서브컴포넌트 재사용)
    └── online-game-board.css
```

## 환경변수

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

- `.env.local`에 로컬 개발용
- Vercel Settings > Environment Variables에 배포용
- `*.local`은 .gitignore에 이미 포함

## Supabase 설정

- Broadcast만 사용 (Realtime 기본 활성화)
- DB 테이블 불필요
- RLS 설정 불필요
- 무료 티어: 동시 접속 500, 이 게임에 충분

## 기존 코드와의 관계

- 기존 솔로/로컬 멀티 모드: **변경 없음**
- `App.tsx`: `appMode` state로 로컬/온라인 분기
- `use-game.ts`: `comparePlacements` export 추가 (1줄)
- 기존 서브컴포넌트(edge-labels, piece-tray, result-panel, planet-overlay): 온라인 보드에서 그대로 재사용

## 알려진 제한사항

- 호스트가 브라우저 닫으면 게임 종료 (서버 없음)
- 재접속 시 room-state 재전송으로 복구 가능하나, 현재 자동 재접속 미구현
- 같은 WiFi 아니어도 동작 (인터넷만 되면 됨, Supabase 경유)
- 방 코드 충돌 확률: 1/900000 (무시 가능)
