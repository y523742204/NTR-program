/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getMatchRule, getSinglesScoreError, normalizeSinglesScore } from '@ntr/shared';

const sixGames = getMatchRule('SIX_GAMES_6_TB');
const oneGame = getMatchRule('ONE_GAME');

describe('getSinglesScoreError', () => {
  it('6局制常规比分分出胜负', () => {
    const result = getSinglesScoreError(sixGames, 6, 4);
    assert.equal(result.ok, true);
    assert.equal(result.completed, true);
    assert.equal(result.winnerSide, 'A');
    assert.deepEqual(normalizeSinglesScore(6, 4), {
      gamesA: 6,
      gamesB: 4,
      tiebreakA: null,
      tiebreakB: null,
    });
  });

  it('比分未达到制胜局数时不允许作为终局', () => {
    const result = getSinglesScoreError(sixGames, 3, 1);
    assert.equal(result.ok, true);
    assert.equal(result.completed, false);
  });

  it('6:6 需凭抢七小分决出胜者', () => {
    const missing = getSinglesScoreError(sixGames, 6, 6, null, 5);
    assert.equal(missing.ok, false);
    const valid = getSinglesScoreError(sixGames, 6, 6, 7, 5);
    assert.equal(valid.ok, true);
    assert.equal(valid.completed, true);
    assert.equal(valid.winnerSide, 'A');
  });

  it('抢七需要至少领先 2 分', () => {
    const result = getSinglesScoreError(sixGames, 6, 6, 7, 6);
    assert.equal(result.ok, false);
    assert.equal(result.completed, false);
  });

  it('抢七小分不足 7 分不允许', () => {
    const result = getSinglesScoreError(sixGames, 6, 6, 6, 4);
    assert.equal(result.ok, false);
  });

  it('一局决胜仅 1 局', () => {
    const result = getSinglesScoreError(oneGame, 1, 0);
    assert.equal(result.completed, true);
    assert.equal(result.winnerSide, 'A');
    const invalid = getSinglesScoreError(oneGame, 2, 0);
    assert.equal(invalid.completed, false);
  });

  it('非法局数或负数被拒绝', () => {
    const result = getSinglesScoreError(sixGames, -1, 2);
    assert.equal(result.ok, false);
  });

  it('6:5 尚未取胜（差 1 局）', () => {
    const result = getSinglesScoreError(sixGames, 6, 5);
    assert.equal(result.completed, false);
  });

  it('7:5 合法（6 局后需领先 2 局）', () => {
    const result = getSinglesScoreError(sixGames, 7, 5);
    assert.equal(result.completed, true);
    assert.equal(result.winnerSide, 'A');
  });
});

describe('normalizeSinglesScore', () => {
  it('非平分时清除冗余抢七小分', () => {
    assert.deepEqual(normalizeSinglesScore(6, 4, 7, 3), {
      gamesA: 6,
      gamesB: 4,
      tiebreakA: null,
      tiebreakB: null,
    });
  });
  it('平分时保留抢七小分', () => {
    assert.deepEqual(normalizeSinglesScore(6, 6, 7, 4), {
      gamesA: 6,
      gamesB: 6,
      tiebreakA: 7,
      tiebreakB: 4,
    });
  });
});
