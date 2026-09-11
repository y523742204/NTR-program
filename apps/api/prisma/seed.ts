import { PrismaPg } from '@prisma/adapter-pg';

import {
  buildKnockoutPairs,
  buildQualifierSeeds,
  generateGroupRoundRobin,
  generateRoundRobin,
  getKnockoutStages,
  MATCH_STAGES,
  splitIntoGroups,
  type MatchStage,
} from '@ntr/shared';

import { PrismaClient } from '../src/generated/prisma/client';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ntr?schema=public';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ADMIN_PHONE = '13800000000';
const USER_PHONE = '13900000000';
const TEST_USER_COUNT = 24;
const RR_ACTIVITY_COUNT = 4;
const GK_ACTIVITY_COUNT = 2;
const GROUP_COUNT = 2;
const QUALIFY_PER_GROUP = 2;
const PLAYERS_PER_ACTIVITY = 8;
const MATCH_RULE_CODE = 'FOUR_GAMES_NO_AD';

const TEST_NAMES = [
  '张伟',
  '王芳',
  '李娜',
  '刘洋',
  '陈静',
  '杨帆',
  '赵磊',
  '黄敏',
  '周杰',
  '吴倩',
  '徐强',
  '孙悦',
  '马超',
  '朱琳',
  '胡军',
  '郭婷',
  '林峰',
  '何雨',
  '高鹏',
  '罗雪',
  '郑凯',
  '梁爽',
  '谢涛',
  '唐糖',
];
const LEVELS = ['2.5', '3.0', '3.5', '4.0', '4.5'];
const GENDERS = ['MALE', 'FEMALE'] as const;

/** 确定性随机数，保证每次种子生成的历史比分一致。 */
function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createRng(20240918);

/** 生成一局符合四局金球规则的完赛比分。 */
function pickScore() {
  if (rng() < 0.25) {
    const aWins = rng() < 0.5;
    const loser = Math.floor(rng() * 5);
    return {
      playerAGames: 3,
      playerBGames: 3,
      playerATiebreakPoints: aWins ? 7 : loser,
      playerBTiebreakPoints: aWins ? loser : 7,
      winnerIsA: aWins,
    };
  }
  const aWins = rng() < 0.5;
  const loser = Math.floor(rng() * 3);
  return {
    playerAGames: aWins ? 4 : loser,
    playerBGames: aWins ? loser : 4,
    playerATiebreakPoints: null,
    playerBTiebreakPoints: null,
    winnerIsA: aWins,
  };
}

async function upsertUsers() {
  const admin = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: {
      name: '王教练',
      role: 'ADMIN',
      gender: 'MALE',
      level: '4.5',
      profileCompletedAt: new Date(),
    },
    create: {
      phone: ADMIN_PHONE,
      name: '王教练',
      role: 'ADMIN',
      gender: 'MALE',
      level: '4.5',
      profileCompletedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { phone: USER_PHONE },
    update: { name: '李明', role: 'USER', gender: 'MALE', level: '3.5' },
    create: { phone: USER_PHONE, name: '李明', role: 'USER', gender: 'MALE', level: '3.5' },
  });

  const testUserIdByIndex: string[] = [];
  for (let i = 0; i < TEST_USER_COUNT; i += 1) {
    const phone = `136${String(i + 1).padStart(8, '0')}`;
    const user = await prisma.user.upsert({
      where: { phone },
      update: {
        name: TEST_NAMES[i],
        role: 'USER',
        gender: GENDERS[i % GENDERS.length],
        level: LEVELS[i % LEVELS.length],
        profileCompletedAt: new Date(),
      },
      create: {
        phone,
        name: TEST_NAMES[i],
        role: 'USER',
        gender: GENDERS[i % GENDERS.length],
        level: LEVELS[i % LEVELS.length],
        profileCompletedAt: new Date(),
      },
    });
    testUserIdByIndex.push(user.id);
  }

  return { adminId: admin.id, testUserIdByIndex };
}

type MatchData = {
  playerAId: string;
  playerBId: string;
  stage: MatchStage | null;
  groupNumber: number | null;
  bracketSlot: number | null;
  courtName: string;
  startAt: Date;
  endAt: Date;
};

function completedMatchFields(activityId: string, actorId: string, data: MatchData) {
  const score = pickScore();
  return {
    activityId,
    roundId: null as string | null,
    stage: data.stage,
    groupNumber: data.groupNumber,
    bracketSlot: data.bracketSlot,
    courtName: data.courtName,
    startAt: data.startAt,
    endAt: data.endAt,
    playerAId: data.playerAId,
    playerBId: data.playerBId,
    playerAGames: score.playerAGames,
    playerBGames: score.playerBGames,
    playerATiebreakPoints: score.playerATiebreakPoints,
    playerBTiebreakPoints: score.playerBTiebreakPoints,
    winnerId: score.winnerIsA ? data.playerAId : data.playerBId,
    recordStatus: 'COMPLETED' as const,
    confirmationState: 'NOT_REQUIRED' as const,
    scoreUpdatedAt: data.endAt,
    scoreSubmittedSide: 'A' as const,
    scoreSubmittedById: actorId,
  };
}

function matchTime(activityStart: Date, roundIndex: number) {
  const startAt = new Date(activityStart.getTime() + roundIndex * 30 * 60 * 1000);
  return { startAt, endAt: new Date(startAt.getTime() + 60 * 60 * 1000) };
}

async function seedRoundRobin(
  activityId: string,
  startAt: Date,
  courtCount: number,
  signupIds: string[],
  actorId: string,
) {
  const rounds = generateRoundRobin(signupIds);
  for (let r = 0; r < rounds.length; r += 1) {
    const round = await prisma.activityRound.create({
      data: { activityId, roundNumber: r + 1 },
    });
    const time = matchTime(startAt, r);
    const matches = rounds[r].map(([playerAId, playerBId], index) => ({
      ...completedMatchFields(activityId, actorId, {
        playerAId,
        playerBId,
        stage: null,
        groupNumber: null,
        bracketSlot: null,
        courtName: `${(index % courtCount) + 1}号场`,
        startAt: time.startAt,
        endAt: time.endAt,
      }),
      roundId: round.id,
    }));
    await prisma.activityMatch.createMany({ data: matches });
  }
}

async function seedGroupKnockout(
  activityId: string,
  startAt: Date,
  courtCount: number,
  signupIds: string[],
  actorId: string,
  enableThirdPlace: boolean,
) {
  const groups = splitIntoGroups(signupIds, GROUP_COUNT);
  const groupRounds = generateGroupRoundRobin(groups);
  const maxRounds = Math.max(...groupRounds.map((group) => group.roundPairs.length));
  const standings = new Map<string, { wins: number; gameDiff: number; gamesWon: number }>();
  for (const id of signupIds) standings.set(id, { wins: 0, gameDiff: 0, gamesWon: 0 });

  for (let r = 0; r < maxRounds; r += 1) {
    const round = await prisma.activityRound.create({
      data: { activityId, roundNumber: r + 1 },
    });
    const time = matchTime(startAt, r);
    const matches: ReturnType<typeof completedMatchFields>[] = [];
    let courtIndex = 0;
    for (const group of groupRounds) {
      for (const [playerAId, playerBId] of group.roundPairs[r] ?? []) {
        const match = {
          ...completedMatchFields(activityId, actorId, {
            playerAId,
            playerBId,
            stage: MATCH_STAGES.GROUP,
            groupNumber: group.groupNumber,
            bracketSlot: null,
            courtName: `${(courtIndex % courtCount) + 1}号场`,
            startAt: time.startAt,
            endAt: time.endAt,
          }),
          roundId: round.id,
        };
        matches.push(match);
        applyStanding(standings, playerAId, playerBId, match);
        courtIndex += 1;
      }
    }
    await prisma.activityMatch.createMany({ data: matches });
  }

  const qualifiedGroupRows = groups.map((group) =>
    group
      .map((id) => ({ id, ...(standings.get(id) ?? { wins: 0, gameDiff: 0, gamesWon: 0 }) }))
      .sort((a, b) => b.wins - a.wins || b.gameDiff - a.gameDiff || b.gamesWon - a.gamesWon)
      .slice(0, QUALIFY_PER_GROUP)
      .map((row) => ({ signupId: row.id })),
  );
  const seeds = buildQualifierSeeds(qualifiedGroupRows, QUALIFY_PER_GROUP);
  const pairs = buildKnockoutPairs(seeds);
  const initialStage = getKnockoutStages(GROUP_COUNT * QUALIFY_PER_GROUP)[0];
  const knockoutTime = matchTime(startAt, maxRounds);

  const semiWinners: string[] = [];
  const semiLosers: string[] = [];
  for (const pair of pairs) {
    if (!pair.seedB) continue;
    const match = await prisma.activityMatch.create({
      data: completedMatchFields(activityId, actorId, {
        playerAId: pair.seedA,
        playerBId: pair.seedB,
        stage: initialStage,
        groupNumber: null,
        bracketSlot: pair.slot,
        courtName: `${(pair.slot % courtCount) + 1}号场`,
        startAt: knockoutTime.startAt,
        endAt: knockoutTime.endAt,
      }),
    });
    const winner = match.winnerId ?? pair.seedA;
    semiWinners.push(winner);
    semiLosers.push(winner === pair.seedA ? pair.seedB : pair.seedA);
  }

  const finalTime = matchTime(startAt, maxRounds + 1);
  if (semiWinners[0] && semiWinners[1]) {
    await prisma.activityMatch.create({
      data: completedMatchFields(activityId, actorId, {
        playerAId: semiWinners[0],
        playerBId: semiWinners[1],
        stage: MATCH_STAGES.FINAL,
        groupNumber: null,
        bracketSlot: 0,
        courtName: '1号场',
        startAt: finalTime.startAt,
        endAt: finalTime.endAt,
      }),
    });
  }

  if (enableThirdPlace && semiLosers[0] && semiLosers[1]) {
    await prisma.activityMatch.create({
      data: completedMatchFields(activityId, actorId, {
        playerAId: semiLosers[0],
        playerBId: semiLosers[1],
        stage: MATCH_STAGES.THIRD_PLACE,
        groupNumber: null,
        bracketSlot: 0,
        courtName: '2号场',
        startAt: finalTime.startAt,
        endAt: finalTime.endAt,
      }),
    });
  }
}

function applyStanding(
  standings: Map<string, { wins: number; gameDiff: number; gamesWon: number }>,
  playerAId: string,
  playerBId: string,
  match: { playerAGames: number; playerBGames: number; winnerId: string | null },
) {
  const rowA = standings.get(playerAId);
  const rowB = standings.get(playerBId);
  if (!rowA || !rowB) return;
  rowA.gamesWon += match.playerAGames;
  rowB.gamesWon += match.playerBGames;
  rowA.gameDiff += match.playerAGames - match.playerBGames;
  rowB.gameDiff += match.playerBGames - match.playerAGames;
  if (match.winnerId === playerAId) rowA.wins += 1;
  else rowB.wins += 1;
}

async function createActivity(input: {
  id: string;
  title: string;
  mode: 'ROUND_ROBIN' | 'GROUP_KNOCKOUT';
  level: string;
  startAt: Date;
  courtCount: number;
  creatorId: string;
  enableThirdPlace?: boolean;
}) {
  return prisma.activity.create({
    data: {
      id: input.id,
      title: input.title,
      note: '种子测试数据',
      level: input.level,
      mode: input.mode,
      status: 'PUBLISHED',
      signupStartAt: new Date(input.startAt.getTime() - 3 * 24 * 60 * 60 * 1000),
      startAt: input.startAt,
      endAt: new Date(input.startAt.getTime() + 3 * 60 * 60 * 1000),
      locationName: '测试网球中心',
      locationAddress: '测试市测试路 1 号',
      venue: '1号场、2号场',
      maxPlayers: PLAYERS_PER_ACTIVITY,
      courtCount: input.courtCount,
      warmupMinutes: 10,
      matchRuleCode: MATCH_RULE_CODE,
      groupCount: input.mode === 'GROUP_KNOCKOUT' ? GROUP_COUNT : null,
      qualifyPerGroup: input.mode === 'GROUP_KNOCKOUT' ? QUALIFY_PER_GROUP : null,
      enableThirdPlace: input.enableThirdPlace ?? null,
      schedulePublishedAt: new Date(input.startAt.getTime() - 60 * 60 * 1000),
      creatorId: input.creatorId,
    },
  });
}

async function seedActivities(adminId: string, testUserIdByIndex: string[]) {
  const activityIds: string[] = [];
  for (let i = 0; i < RR_ACTIVITY_COUNT; i += 1) activityIds.push(`seed-rr-${i + 1}`);
  for (let i = 0; i < GK_ACTIVITY_COUNT; i += 1) activityIds.push(`seed-gk-${i + 1}`);
  await prisma.activity.deleteMany({ where: { id: { in: activityIds } } });

  const now = Date.now();
  const activities: { id: string; mode: 'ROUND_ROBIN' | 'GROUP_KNOCKOUT'; startAt: Date }[] = [];

  for (let i = 0; i < RR_ACTIVITY_COUNT; i += 1) {
    const startAt = new Date(now - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    startAt.setHours(9, 0, 0, 0);
    await createActivity({
      id: `seed-rr-${i + 1}`,
      title: `[测试] 周末循环赛 ${i + 1}`,
      mode: 'ROUND_ROBIN',
      level: LEVELS[i % LEVELS.length],
      startAt,
      courtCount: 2,
      creatorId: adminId,
    });
    activities.push({ id: `seed-rr-${i + 1}`, mode: 'ROUND_ROBIN', startAt });
  }

  for (let i = 0; i < GK_ACTIVITY_COUNT; i += 1) {
    const startAt = new Date(now - (RR_ACTIVITY_COUNT + i + 1) * 7 * 24 * 60 * 60 * 1000);
    startAt.setHours(13, 0, 0, 0);
    await createActivity({
      id: `seed-gk-${i + 1}`,
      title: `[测试] 小组淘汰赛 ${i + 1}`,
      mode: 'GROUP_KNOCKOUT',
      level: LEVELS[(i + 2) % LEVELS.length],
      startAt,
      courtCount: 2,
      creatorId: adminId,
      enableThirdPlace: i === 0,
    });
    activities.push({ id: `seed-gk-${i + 1}`, mode: 'GROUP_KNOCKOUT', startAt });
  }

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index];
    const start = (index * 5) % TEST_USER_COUNT;
    const players = Array.from(
      { length: PLAYERS_PER_ACTIVITY },
      (_, k) => testUserIdByIndex[(start + k) % TEST_USER_COUNT],
    );

    await prisma.activitySignup.createMany({
      data: players.map((userId, k) => ({
        activityId: activity.id,
        userId,
        participantName: TEST_NAMES[(start + k) % TEST_USER_COUNT],
        gender: GENDERS[(start + k) % GENDERS.length],
        status: 'CONFIRMED' as const,
      })),
    });

    const signups = await prisma.activitySignup.findMany({
      where: { activityId: activity.id },
      select: { id: true, userId: true },
    });
    const signupIdByUserId = new Map(signups.map((signup) => [signup.userId, signup.id]));
    const signupIds = players
      .map((userId) => signupIdByUserId.get(userId))
      .filter((id): id is string => Boolean(id));

    if (activity.mode === 'ROUND_ROBIN') {
      await seedRoundRobin(activity.id, activity.startAt, 2, signupIds, adminId);
    } else {
      await seedGroupKnockout(
        activity.id,
        activity.startAt,
        2,
        signupIds,
        adminId,
        index === RR_ACTIVITY_COUNT,
      );
    }
  }
}

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.warn('跳过生产环境 seed');
    return;
  }
  const { adminId, testUserIdByIndex } = await upsertUsers();
  await seedActivities(adminId, testUserIdByIndex);
  console.log(
    `Seed complete: admin(${ADMIN_PHONE}) + user(${USER_PHONE}) + ${TEST_USER_COUNT} 测试用户 + ${RR_ACTIVITY_COUNT} 循环赛 + ${GK_ACTIVITY_COUNT} 小组淘汰赛`,
  );
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
