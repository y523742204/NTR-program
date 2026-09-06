/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignCourtLabels,
  buildKnockoutPairs,
  buildQualifierSeeds,
  generateGroupRoundRobin,
  generateRoundRobin,
  getBracketParent,
  getKnockoutStageDepth,
  getKnockoutStages,
  getStageMatchCount,
  splitIntoGroups,
} from '@ntr/shared';

describe('generateRoundRobin', () => {
  it('偶数人数时每名选手与其余选手恰好相遇一次', () => {
    for (const n of [2, 4, 6, 8]) {
      const players = Array.from({ length: n }, (_, index) => index);
      const rounds = generateRoundRobin(players);
      assert.equal(rounds.length, n - 1, `n=${n} 轮数应为 n-1`);
      const pairs = new Set<string>();
      for (const round of rounds) {
        assert.equal(round.length, n / 2, `n=${n} 每轮应有 n/2 场`);
        for (const [a, b] of round) {
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          assert.ok(!pairs.has(key), `重复对阵 ${key}`);
          pairs.add(key);
        }
      }
      assert.equal(pairs.size, (n * (n - 1)) / 2, '应覆盖全部两两组合');
      assert.equal(pairs.size, rounds.length * (n / 2));
    }
  });

  it('奇数人数时插入轮空，每轮减少一场且每人轮空恰好一次', () => {
    const players = ['a', 'b', 'c', 'd', 'e'];
    const rounds = generateRoundRobin(players);
    assert.equal(rounds.length, 5);
    const byeCount = new Map(players.map((name) => [name, 0]));
    const pairs = new Set<string>();
    for (const round of rounds) {
      assert.equal(round.length, 2, '5 人每轮应有 2 场');
      for (const [a, b] of round) {
        pairs.add(`${a}-${b}`);
      }
    }
    for (let round = 0; round < rounds.length; round += 1) {
      const matched = new Set(rounds[round].flat());
      for (const name of players) {
        if (!matched.has(name)) byeCount.set(name, byeCount.get(name)! + 1);
      }
    }
    assert.deepEqual([...byeCount.values()], [1, 1, 1, 1, 1]);
    assert.equal(pairs.size, (5 * 4) / 2);
  });
});

describe('小组与种子', () => {
  it('splitIntoGroups 等量分组', () => {
    const groups = splitIntoGroups([1, 2, 3, 4, 5, 6, 7, 8], 2);
    assert.deepEqual(groups, [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
  });

  it('generateGroupRoundRobin 为每组生成完整轮次', () => {
    const groups = [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    const result = generateGroupRoundRobin(groups);
    assert.equal(result.length, 2);
    for (const group of result) {
      assert.equal(group.roundPairs.length, 3, '每组 4 人应收敛为 3 轮');
      const flat = group.roundPairs.flat();
      assert.equal(flat.length, 6, '每组 6 场');
    }
    assert.deepEqual(
      result.map((group) => group.groupNumber),
      [1, 2],
    );
  });

  it('buildQualifierSeeds 按“先各组头名、再各组次名”交叉输出', () => {
    const groups = [
      [{ signupId: 'w1' }, { signupId: 'r1' }],
      [{ signupId: 'w2' }, { signupId: 'r2' }],
      [{ signupId: 'w3' }, { signupId: 'r3' }],
      [{ signupId: 'w4' }, { signupId: 'r4' }],
    ];
    const seeds = buildQualifierSeeds(groups, 2);
    assert.deepEqual(seeds, ['w1', 'w2', 'w3', 'w4', 'r1', 'r2', 'r3', 'r4']);
  });
});

describe('淘汰赛结构', () => {
  it('getKnockoutStages 覆盖各档人数', () => {
    assert.deepEqual(getKnockoutStages(2), ['FINAL']);
    assert.deepEqual(getKnockoutStages(4), ['SEMI_FINAL', 'FINAL']);
    assert.deepEqual(getKnockoutStages(8), ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL']);
    assert.deepEqual(getKnockoutStages(16), [
      'ROUND_OF_16',
      'QUARTER_FINAL',
      'SEMI_FINAL',
      'FINAL',
    ]);
    assert.throws(() => getKnockoutStages(6));
    assert.throws(() => getKnockoutStages(64));
  });

  it('getStageMatchCount 与深度对应', () => {
    assert.equal(getStageMatchCount(0), 1);
    assert.equal(getStageMatchCount(1), 2);
    assert.equal(getStageMatchCount(3), 8);
  });

  it('getBracketParent 相邻槽位进入上一级同侧', () => {
    assert.deepEqual(getBracketParent(2, 0), { parentSlot: 0, side: 'A' });
    assert.deepEqual(getBracketParent(2, 1), { parentSlot: 0, side: 'B' });
    assert.deepEqual(getBracketParent(2, 2), { parentSlot: 1, side: 'A' });
    assert.deepEqual(getBracketParent(2, 3), { parentSlot: 1, side: 'B' });
  });

  it('getKnockoutStageDepth 语义', () => {
    assert.equal(getKnockoutStageDepth('FINAL'), 0);
    assert.equal(getKnockoutStageDepth('SEMI_FINAL'), 1);
    assert.equal(getKnockoutStageDepth('ROUND_OF_32'), 4);
    assert.equal(getKnockoutStageDepth('GROUP'), -1);
  });

  it('buildKnockoutPairs 首轮避免同组相遇', () => {
    const seeds = ['w1', 'w2', 'w3', 'w4', 'r1', 'r2', 'r3', 'r4'];
    const pairs = buildKnockoutPairs(seeds);
    assert.equal(pairs.length, 4);
    assert.equal(pairs[0].stage, 'QUARTER_FINAL');
    for (const pair of pairs) {
      const winnerGroup = pair.seedA[1];
      const runnerGroup = pair.seedB == null ? null : (pair.seedB.match(/[0-9]+/) ?? [null])[0];
      if (pair.seedB) {
        assert.notEqual(winnerGroup, pair.seedB[1], `${pair.seedA} 不应首轮对 ${pair.seedB}`);
      }
      void runnerGroup;
    }
    const seen = new Set(
      pairs.flatMap((pair) => [pair.seedA, ...(pair.seedB ? [pair.seedB] : [])]),
    );
    assert.equal(seen.size, 8, '每个出线选手恰好出现一次');
  });
});

describe('assignCourtLabels', () => {
  it('场地数不足时循环复用', () => {
    assert.deepEqual(assignCourtLabels(4, 2), ['1号场', '2号场', '1号场', '2号场']);
  });
  it('场地数充足时依次编号', () => {
    assert.deepEqual(assignCourtLabels(3, 4), ['1号场', '2号场', '3号场']);
  });
});
