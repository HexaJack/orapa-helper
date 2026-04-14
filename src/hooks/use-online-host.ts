import { useState, useCallback, useEffect, useRef } from 'react'
import type { GameMode, Planet } from '../game/types'
import type { DifficultyLevel } from '../game/difficulty'
import { generateBoardWithDifficulty } from '../game/difficulty'
import { fireLaser } from '../game/laser'
import { comparePlacements } from './use-game'
import { supabase, generateRoomCode, getPlayerId } from '../game/supabase'
import type { PlayerInfo, RoomState, RoomPhase, HistoryEntry, ClientMessage } from '../game/multiplayer-types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useOnlineHost(hostName: string, gameMode: GameMode, targetDifficulty: DifficultyLevel | 'any') {
  const [roomCode] = useState(generateRoomCode)
  const [hostId] = useState(getPlayerId)
  const [roomState, setRoomState] = useState<RoomState>(() => ({
    roomCode,
    gameMode,
    difficulty: 0,
    players: [{
      id: getPlayerId(),
      name: hostName,
      wrongAnswers: 0,
      eliminated: false,
      online: true,
    }],
    currentTurnPlayerId: null,
    history: [],
    phase: 'lobby' as RoomPhase,
    winnerId: null,
    firedLabels: [],
  }))
  const [planets, setPlanets] = useState<Planet[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const stateRef = useRef(roomState)
  const planetsRef = useRef(planets)
  useEffect(() => { stateRef.current = roomState }, [roomState])
  useEffect(() => { planetsRef.current = planets }, [planets])

  // 방 상태 브로드캐스트
  const broadcastState = useCallback((state: RoomState) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'host-message',
      payload: { type: 'room-state', state },
    })
  }, [])

  // 다음 턴 플레이어 찾기 (탈락자 스킵)
  const getNextTurnPlayerId = useCallback((currentId: string | null, players: PlayerInfo[]): string | null => {
    const active = players.filter(p => !p.eliminated)
    if (active.length === 0) return null
    if (!currentId) return active[0].id
    const currentIdx = active.findIndex(p => p.id === currentId)
    return active[(currentIdx + 1) % active.length].id
  }, [])

  // 클라이언트 메시지 처리
  const handleClientMessage = useCallback((msg: ClientMessage) => {
    const state = stateRef.current

    switch (msg.type) {
      case 'join-request': {
        const existing = state.players.find(p => p.id === msg.playerId)
        if (existing) {
          // 재접속: 기존 플레이어 → 현재 상태 전송
          broadcastState(state)
          return
        }
        if (state.phase !== 'lobby') return // 새 플레이어는 로비에서만
        const newPlayer: PlayerInfo = {
          id: msg.playerId,
          name: msg.playerName,
          wrongAnswers: 0,
          eliminated: false,
          online: true,
        }
        const updated = { ...state, players: [...state.players, newPlayer] }
        setRoomState(updated)
        broadcastState(updated)
        break
      }

      case 'fire-request': {
        if (state.phase !== 'playing') return
        if (state.currentTurnPlayerId !== msg.playerId) return
        const player = state.players.find(p => p.id === msg.playerId)
        if (!player || player.eliminated) return
        if (state.firedLabels.includes(msg.label)) return

        const result = fireLaser(msg.label, planetsRef.current)
        const entry: HistoryEntry = {
          label: msg.label,
          result,
          playerId: msg.playerId,
          playerName: player.name,
        }
        const nextId = getNextTurnPlayerId(msg.playerId, state.players)
        const newFired = [...state.firedLabels, msg.label]

        const updated: RoomState = {
          ...state,
          history: [...state.history, entry],
          currentTurnPlayerId: nextId,
          firedLabels: newFired,
        }
        setRoomState(updated)

        channelRef.current?.send({
          type: 'broadcast',
          event: 'host-message',
          payload: {
            type: 'shot-result',
            label: msg.label,
            result,
            playerId: msg.playerId,
            playerName: player.name,
            nextTurnPlayerId: nextId,
          },
        })
        break
      }

      case 'answer-submission': {
        if (state.phase !== 'playing') return
        const player = state.players.find(p => p.id === msg.playerId)
        if (!player || player.eliminated) return

        const correct = comparePlacements(msg.planets, planetsRef.current)

        if (correct) {
          const updated: RoomState = {
            ...state,
            phase: 'finished',
            winnerId: msg.playerId,
          }
          setRoomState(updated)
          channelRef.current?.send({
            type: 'broadcast',
            event: 'host-message',
            payload: { type: 'answer-correct', playerId: msg.playerId },
          })
          channelRef.current?.send({
            type: 'broadcast',
            event: 'host-message',
            payload: { type: 'game-over', winnerId: msg.playerId },
          })
          broadcastState(updated)
        } else {
          const newWrong = player.wrongAnswers + 1
          const eliminated = newWrong >= 2
          const updatedPlayers = state.players.map(p =>
            p.id === msg.playerId ? { ...p, wrongAnswers: newWrong, eliminated } : p
          )

          channelRef.current?.send({
            type: 'broadcast',
            event: 'host-message',
            payload: { type: 'answer-wrong', playerId: msg.playerId, wrongCount: newWrong },
          })

          if (eliminated) {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'host-message',
              payload: { type: 'player-eliminated', playerId: msg.playerId },
            })
          }

          // 전원 탈락 체크
          const allEliminated = updatedPlayers.every(p => p.eliminated)
          const updated: RoomState = {
            ...state,
            players: updatedPlayers,
            phase: allEliminated ? 'finished' : 'playing',
            winnerId: allEliminated ? null : state.winnerId,
            currentTurnPlayerId: eliminated && state.currentTurnPlayerId === msg.playerId
              ? getNextTurnPlayerId(msg.playerId, updatedPlayers)
              : state.currentTurnPlayerId,
          }
          setRoomState(updated)

          if (allEliminated) {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'host-message',
              payload: { type: 'game-over', winnerId: null },
            })
          }
          broadcastState(updated)
        }
        break
      }

      case 'leave': {
        const updatedPlayers = state.players.filter(p => p.id !== msg.playerId)
        const updated: RoomState = {
          ...state,
          players: updatedPlayers,
          currentTurnPlayerId: state.currentTurnPlayerId === msg.playerId
            ? getNextTurnPlayerId(msg.playerId, updatedPlayers)
            : state.currentTurnPlayerId,
        }
        setRoomState(updated)
        broadcastState(updated)
        break
      }
    }
  }, [broadcastState, getNextTurnPlayerId])

  // ref로 최신 핸들러 참조 (useEffect 의존성에서 제거)
  const handleClientMessageRef = useRef(handleClientMessage)
  useEffect(() => { handleClientMessageRef.current = handleClientMessage }, [handleClientMessage])

  // 채널 초기화 (한 번만)
  useEffect(() => {
    const channel = supabase.channel(roomCode, {
      config: { broadcast: { self: true } },
    })

    channel.on('broadcast', { event: 'client-message' }, ({ payload }) => {
      handleClientMessageRef.current(payload as ClientMessage)
    })

    // Presence로 접속 상태 추적
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState()
      const onlineIds = new Set<string>()
      for (const key in presenceState) {
        for (const p of presenceState[key] as Record<string, unknown>[]) {
          if (p['playerId']) onlineIds.add(p['playerId'] as string)
        }
      }
      setRoomState(prev => {
        const updated = {
          ...prev,
          players: prev.players.map(p => ({ ...p, online: onlineIds.has(p.id) })),
        }
        return updated
      })
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ playerId: hostId })
      }
    })
    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [roomCode, hostId, hostName, gameMode])

  // 게임 시작
  const startGame = useCallback(() => {
    const { planets: newPlanets, difficulty: diff } = generateBoardWithDifficulty(
      stateRef.current.gameMode,
      targetDifficulty
    )
    setPlanets(newPlanets)
    const firstPlayer = stateRef.current.players[0]
    const updated: RoomState = {
      ...stateRef.current,
      phase: 'playing',
      difficulty: diff.score,
      currentTurnPlayerId: firstPlayer?.id ?? null,
      history: [],
      firedLabels: [],
      winnerId: null,
    }
    // 모든 플레이어 초기화
    updated.players = updated.players.map(p => ({
      ...p, wrongAnswers: 0, eliminated: false,
    }))
    setRoomState(updated)
    broadcastState(updated)
  }, [targetDifficulty, broadcastState])

  // 호스트 자신의 발사
  const hostFire = useCallback((label: string) => {
    handleClientMessage({ type: 'fire-request', playerId: hostId, label })
  }, [hostId, handleClientMessage])

  // 호스트 자신의 정답 제출
  const hostSubmitAnswer = useCallback((answer: Planet[]) => {
    handleClientMessage({ type: 'answer-submission', playerId: hostId, planets: answer })
  }, [hostId, handleClientMessage])

  // 턴 넘기기
  const skipTurn = useCallback((targetPlayerId: string) => {
    const state = stateRef.current
    if (state.currentTurnPlayerId !== targetPlayerId) return
    const nextId = getNextTurnPlayerId(targetPlayerId, state.players)
    const updated = { ...state, currentTurnPlayerId: nextId }
    setRoomState(updated)
    broadcastState(updated)
  }, [broadcastState, getNextTurnPlayerId])

  // 추방
  const kickPlayer = useCallback((targetPlayerId: string) => {
    const state = stateRef.current
    const updatedPlayers = state.players.map(p =>
      p.id === targetPlayerId ? { ...p, eliminated: true } : p
    )
    const updated: RoomState = {
      ...state,
      players: updatedPlayers,
      currentTurnPlayerId: state.currentTurnPlayerId === targetPlayerId
        ? getNextTurnPlayerId(targetPlayerId, updatedPlayers)
        : state.currentTurnPlayerId,
    }
    setRoomState(updated)
    channelRef.current?.send({
      type: 'broadcast', event: 'host-message',
      payload: { type: 'player-eliminated', playerId: targetPlayerId },
    })
    broadcastState(updated)
  }, [broadcastState, getNextTurnPlayerId])

  return {
    roomCode,
    roomState,
    hostId,
    planets,
    startGame,
    hostFire,
    hostSubmitAnswer,
    skipTurn,
    kickPlayer,
  }
}
