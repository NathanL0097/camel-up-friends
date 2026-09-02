import type { ActionCardType, ColtGameState } from "./types";

export type JoinRoomPayload = {
  code: string;
  name: string;
  playerToken?: string | null;
  roomPassword?: string;
};

export type PlayCardPayload = { cardId: string };

export type ExecuteActionPayload = {
  carIndex?: number;
  targetId?: string;
  destination?: number;
  lootId?: string;
};

export type CardExecutedPayload = {
  sequence: number;
  cardType: ActionCardType;
  ownerId: string;
  title: string;
  detail: string;
};

/**
 * The platform keeps one transport vocabulary for every game. These aliases
 * document the Colt Express messages requested by the module specification.
 */
export const COLT_SOCKET_PROTOCOL = {
  JOIN_ROOM: "room:join",
  PLAY_CARD: "game:action/play-card",
  EXECUTE_ACTION: "game:action/execute-action",
  CARD_EXECUTED: "room:update/game.lastEvent",
  GAME_STATE_UPDATE: "room:update"
} as const;

export interface ColtClientToServerEvents {
  JOIN_ROOM(payload: JoinRoomPayload): void;
  PLAY_CARD(payload: PlayCardPayload): void;
  EXECUTE_ACTION(payload: ExecuteActionPayload): void;
  ACK_EVENT(): void;
}

export interface ColtServerToClientEvents {
  CARD_EXECUTED(payload: CardExecutedPayload): void;
  GAME_STATE_UPDATE(state: ColtGameState): void;
}
