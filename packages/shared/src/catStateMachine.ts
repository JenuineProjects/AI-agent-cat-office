import { CatState } from './types.js';
import { IDLE_SLEEP_TIMEOUT, IDLE_BEHAVIOR_CHANCE, IDLE_BEHAVIORS } from './constants.js';

export interface StateMachineContext {
  currentState: CatState;
  lastActivityTime: number;
  idleStartTime: number | null;
}

export type TransitionEvent =
  | { type: 'TOOL_USE'; toolAction: CatState }
  | { type: 'TOOL_RESULT' }
  | { type: 'ARRIVED_AT_DESTINATION' }
  | { type: 'ANIMATION_COMPLETE' }
  | { type: 'IDLE_TICK' }
  | { type: 'WANDER' }
  | { type: 'NEW_SESSION' }
  | { type: 'SESSION_END' };

export interface TransitionResult {
  newState: CatState;
  targetAction?: CatState;
}

export function transition(
  ctx: StateMachineContext,
  event: TransitionEvent,
  now: number = Date.now(),
): TransitionResult | null {
  const { currentState } = ctx;

  switch (event.type) {
    case 'TOOL_USE': {
      if (currentState === CatState.Sleeping) {
        return { newState: CatState.Walking, targetAction: event.toolAction };
      }
      if (currentState === CatState.Idle) {
        return { newState: CatState.Walking, targetAction: event.toolAction };
      }
      if (
        currentState === CatState.Playing ||
        currentState === CatState.Eating
      ) {
        return { newState: CatState.Walking, targetAction: event.toolAction };
      }
      // Already doing a work action — stay put, don't bounce between stations
      if (currentState === CatState.Typing || currentState === CatState.Reading || currentState === CatState.Searching) {
        return null;
      }
      // Walking — don't redirect, let the cat finish its current walk
      if (currentState === CatState.Walking) {
        return null;
      }
      return null;
    }

    case 'ARRIVED_AT_DESTINATION': {
      if (currentState === CatState.Walking) {
        // The catAgent will set the appropriate action state
        return null;
      }
      return null;
    }

    case 'TOOL_RESULT': {
      if (
        currentState === CatState.Typing ||
        currentState === CatState.Reading ||
        currentState === CatState.Searching
      ) {
        return { newState: CatState.Idle };
      }
      return null;
    }

    case 'ANIMATION_COMPLETE': {
      if (
        currentState === CatState.Playing ||
        currentState === CatState.Eating
      ) {
        return { newState: CatState.Idle };
      }
      return null;
    }

    case 'IDLE_TICK': {
      if (currentState !== CatState.Idle) return null;

      const idleDuration = ctx.idleStartTime ? now - ctx.idleStartTime : 0;

      // Sleep after long idle — walk to bed first
      if (idleDuration >= IDLE_SLEEP_TIMEOUT) {
        return { newState: CatState.Walking, targetAction: CatState.Sleeping };
      }

      // Random idle behaviors
      if (Math.random() < IDLE_BEHAVIOR_CHANCE) {
        const behavior = IDLE_BEHAVIORS[Math.floor(Math.random() * IDLE_BEHAVIORS.length)];
        return { newState: CatState.Walking, targetAction: behavior };
      }

      return null;
    }

    case 'WANDER': {
      if (currentState === CatState.Idle) {
        return { newState: CatState.Walking };
      }
      return null;
    }

    case 'SESSION_END': {
      return { newState: CatState.Sleeping };
    }

    case 'NEW_SESSION': {
      if (currentState === CatState.Sleeping) {
        return { newState: CatState.Idle };
      }
      return null;
    }
  }

  return null;
}
