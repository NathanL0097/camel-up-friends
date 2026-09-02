export type GamePhase = "dealing" | "round-briefing" | "planning" | "planning-result" | "executing" | "execution-result" | "round-result" | "end";
export type ActionCardType = "move" | "floor" | "shoot" | "punch" | "rob" | "marshal";
export type PlanningTurnType = "standard" | "tunnel" | "double" | "reverse";
export type LootType = "purse" | "jewel" | "strongbox";

export interface Position {
  carIndex: number;
  isRoof: boolean;
}

export interface Loot {
  id: string;
  type: LootType;
  value: number;
}

export interface Character {
  id: "ghost" | "belle" | "cheyenne" | "django" | "doc" | "tuco";
  name: string;
  color: string;
  skill: string;
}

export interface DeckCard {
  id: string;
  kind: "action" | "bullet";
  cardType?: ActionCardType;
  shooterId?: string;
  neutral?: boolean;
}

export interface Player {
  id: string;
  name: string;
  character: Character;
  position: Position;
  hand: DeckCard[];
  drawPile: DeckCard[];
  discardPile: DeckCard[];
  loot: Loot[];
  bulletsRemaining: number;
  bulletsReceived: DeckCard[];
  shotsFired: number;
  planningDecisionCount: number;
}

export interface TrainCar {
  index: number;
  type: "car" | "locomotive";
  name: string;
  insideLoot: Loot[];
  roofLoot: Loot[];
  hasMarshal: boolean;
}

export interface ActionCard {
  id: string;
  cardType: ActionCardType;
  ownerId: string;
  isHidden: boolean;
  turnType: PlanningTurnType;
  turnNumber: number;
}

export interface RoundCard {
  id: string;
  turns: PlanningTurnType[];
  event: string | null;
}

export interface ColtGameState {
  status: "playing" | "finished";
  phase: GamePhase;
  players: Player[];
  round: number;
  roundCards: RoundCard[];
  roundCard: RoundCard;
  roundEventPreview: { id: string | null; name: string; icon: string; detail: string };
  trainCars: TrainCar[];
  actionStack: ActionCard[];
  executionIndex: number;
  currentAction: ActionCard | null;
  marshalCarIndex: number;
  firstPlayerIndex: number;
  actorId: string | null;
  eventAcks: string[];
  eventSeq: number;
  lastEvent: Record<string, unknown> | null;
}

/*
State machine:
dealing -> planning: reveal a RoundCard, shuffle every player's actions and received
bullets, then deal 6 cards (Doc deals 7). The RoundCard expands into an exact actor
sequence. Tunnel steps force hidden cards, reverse steps invert play order, and double
steps give each actor two consecutive decisions. A decision is either PLAY_CARD or
DRAW_CARDS(3).

planning -> executing: unplayed cards return to their owner's draw pile. ActionStack is
read FIFO; hidden cards are revealed only when they become currentAction.

executing -> execution-result: the owner selects a legal option and confirms it. The
server validates the option, applies the action or a no-effect fallback, and broadcasts
one CARD_EXECUTED event. Every connected player acknowledges the readable result before
the state machine advances to the next card.

execution-result -> executing/round-result: after the final action, resolve the RoundCard
event and pause again. Then rotate first player and deal the next round. After round 5,
calculate loot, Gunslinger bonuses and tie-breakers, then enter end.
*/
