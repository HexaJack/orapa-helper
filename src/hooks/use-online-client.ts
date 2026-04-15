import { useState, useCallback, useEffect, useRef } from 'react'
import type { Planet } from '../game/types'
import { supabase, getPlayerId } from '../game/supabase'
import type { RoomState, HostMessage } from '../game/multiplayer-types'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useOnlineClient(roomCode: string, playerName: string) {
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const playerId = getPlayerId()

  const [hostTimeout, setHostTimeout] = useState(false)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }, [])

  // 15초 타임아웃: 호스트 응답 없으면 경고
  useEffect(() => {
    if (roomState) return // 이미 연결됨
    const timer = setTimeout(() => {
      setHostTimeout(true)
    }, 15000)
    return () => clearTimeout(timer)
  }, [roomState])

  // 호스트 메시지 처리
  const handleHostMessage = useCallback((msg: HostMessage) => {
    switch (msg.type) {
      case 'room-state':
        setRoomState(msg.state)
        break

      case 'shot-result':
        setRoomState(prev => {
          if (!prev) return prev
          return {
            ...prev,
            history: [...prev.history, {
              label: msg.label,
              result: msg.result,
              playerId: msg.playerId,
              playerName: msg.playerName,
            }],
            currentTurnPlayerId: msg.nextTurnPlayerId,
            firedLabels: [...prev.firedLabels, msg.label],
          }
        })
        break

      case 'answer-wrong':
        if (msg.playerId === playerId) {
          showToast(`틀렸습니다! (${msg.wrongCount}/2)`)
        }
        setRoomState(prev => {
          if (!prev) return prev
          return {
            ...prev,
            players: prev.players.map(p =>
              p.id === msg.playerId ? { ...p, wrongAnswers: msg.wrongCount } : p
            ),
          }
        })
        break

      case 'player-eliminated':
        if (msg.playerId === playerId) {
          showToast('2회 오답으로 탈락되었습니다')
        }
        setRoomState(prev => {
          if (!prev) return prev
          return {
            ...prev,
            players: prev.players.map(p =>
              p.id === msg.playerId ? { ...p, eliminated: true } : p
            ),
          }
        })
        break

      case 'answer-correct': {
        const winner = roomState?.players.find(p => p.id === msg.playerId)
        showToast(`${winner?.name ?? '플레이어'}님이 정답을 맞췄습니다!`)
        break
      }

      case 'game-over':
        setRoomState(prev => {
          if (!prev) return prev
          return { ...prev, phase: 'finished', winnerId: msg.winnerId }
        })
        break
    }
  }, [playerId, showToast, roomState?.players])

  // ref로 최신 핸들러 참조
  const handleHostMessageRef = useRef(handleHostMessage)
  useEffect(() => { handleHostMessageRef.current = handleHostMessage }, [handleHostMessage])

  // 채널 연결 (한 번만)
  useEffect(() => {
    const channel = supabase.channel(roomCode, {
      config: { broadcast: { self: true } },
    })

    channel.on('broadcast', { event: 'host-message' }, ({ payload }) => {
      handleHostMessageRef.current(payload as HostMessage)
    })

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        await channel.track({ playerId })
        channel.send({
          type: 'broadcast',
          event: 'client-message',
          payload: { type: 'join-request', playerId, playerName },
        })
      }
    })

    channelRef.current = channel

    return () => {
      channel.send({
        type: 'broadcast',
        event: 'client-message',
        payload: { type: 'leave', playerId },
      })
      channel.unsubscribe()
    }
  }, [roomCode, playerId, playerName])

  // 발사 요청
  const requestFire = useCallback((label: string) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'client-message',
      payload: { type: 'fire-request', playerId, label },
    })
  }, [playerId])

  // 정답 제출
  const submitAnswer = useCallback((planets: Planet[]) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'client-message',
      payload: { type: 'answer-submission', playerId, planets },
    })
  }, [playerId])

  // 내 정보
  const myPlayer = roomState?.players.find(p => p.id === playerId) ?? null
  const isMyTurn = roomState?.currentTurnPlayerId === playerId
  const isEliminated = myPlayer?.eliminated ?? false

  return {
    playerId,
    roomState,
    connected,
    toast,
    hostTimeout,
    myPlayer,
    isMyTurn,
    isEliminated,
    requestFire,
    submitAnswer,
  }
}
