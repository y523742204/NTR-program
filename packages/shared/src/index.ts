export const APP_NAME = 'NTR';

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export const USER_ROLES = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export type ParticipantGender = 'MALE' | 'FEMALE';

export const ACTIVITY_MODES = {
  ROUND_ROBIN: 'ROUND_ROBIN',
  GROUP_KNOCKOUT: 'GROUP_KNOCKOUT',
} as const;
export type ActivityMode = (typeof ACTIVITY_MODES)[keyof typeof ACTIVITY_MODES];

export const ACTIVITY_STATUSES = { PUBLISHED: 'PUBLISHED', CANCELED: 'CANCELED' } as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[keyof typeof ACTIVITY_STATUSES];

export const SIGNUP_STATUSES = { CONFIRMED: 'CONFIRMED', WAITLISTED: 'WAITLISTED' } as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[keyof typeof SIGNUP_STATUSES];

export const MATCH_STAGES = {
  GROUP: 'GROUP',
  ROUND_OF_32: 'ROUND_OF_32',
  ROUND_OF_16: 'ROUND_OF_16',
  QUARTER_FINAL: 'QUARTER_FINAL',
  SEMI_FINAL: 'SEMI_FINAL',
  FINAL: 'FINAL',
  THIRD_PLACE: 'THIRD_PLACE',
} as const;
export type MatchStage = (typeof MATCH_STAGES)[keyof typeof MATCH_STAGES];

export const MATCH_SCORE_RECORD_STATUSES = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  UNPLAYED: 'UNPLAYED',
} as const;
export type MatchScoreRecordStatus =
  (typeof MATCH_SCORE_RECORD_STATUSES)[keyof typeof MATCH_SCORE_RECORD_STATUSES];

export const MATCH_SCORE_CONFIRMATION_STATES = {
  NONE: 'NONE',
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING_CONFIRM: 'PENDING_CONFIRM',
  CONFIRMED: 'CONFIRMED',
  DISPUTED: 'DISPUTED',
} as const;
export type MatchScoreConfirmationState =
  (typeof MATCH_SCORE_CONFIRMATION_STATES)[keyof typeof MATCH_SCORE_CONFIRMATION_STATES];

export type MatchSide = 'A' | 'B';

export const KNOCKOUT_STAGE_LABELS: Record<MatchStage, string> = {
  GROUP: '小组赛',
  ROUND_OF_32: '32强',
  ROUND_OF_16: '16强',
  QUARTER_FINAL: '8强',
  SEMI_FINAL: '半决赛',
  FINAL: '决赛',
  THIRD_PLACE: '三四名',
};

export const KNOCKOUT_STAGE_ORDER: MatchStage[] = [
  MATCH_STAGES.ROUND_OF_32,
  MATCH_STAGES.ROUND_OF_16,
  MATCH_STAGES.QUARTER_FINAL,
  MATCH_STAGES.SEMI_FINAL,
  MATCH_STAGES.FINAL,
];

/**
 * 淘汰赛阶段深度：
 * FINAL=0, SEMI=1, QUARTER_FINAL=2, ROUND_OF_16=3, ROUND_OF_32=4
 */
export function getKnockoutStageDepth(stage: MatchStage): number {
  switch (stage) {
    case MATCH_STAGES.FINAL:
      return 0;
    case MATCH_STAGES.SEMI_FINAL:
      return 1;
    case MATCH_STAGES.QUARTER_FINAL:
      return 2;
    case MATCH_STAGES.ROUND_OF_16:
      return 3;
    case MATCH_STAGES.ROUND_OF_32:
      return 4;
    default:
      return -1;
  }
}

/** 淘汰赛在给定阶段的对局数量。 */
export function getStageMatchCount(depth: number): number {
  return 2 ** depth;
}

/** 从淘汰赛参赛人数推导出从首轮到决赛的全部阶段（由深到浅）。 */
export function getKnockoutStages(qualifierCount: number): MatchStage[] {
  if (qualifierCount < 2 || qualifierCount > 32 || qualifierCount & (qualifierCount - 1)) {
    throw new Error(`淘汰赛人数必须为 2~32 的 2 的幂，收到 ${qualifierCount}`);
  }
  const depth = Math.log2(qualifierCount);
  const stages: MatchStage[] = [];
  for (let d = 0; d <= depth; d += 1) {
    stages.unshift(KNOCKOUT_STAGE_ORDER[KNOCKOUT_STAGE_ORDER.length - 1 - d]);
  }
  return stages;
}

/** 判断某阶段是否为淘汰赛阶段。 */
export function isKnockoutStage(stage: MatchStage): boolean {
  return getKnockoutStageDepth(stage) >= 0;
}

/** 当前阶段对局 slot i 的胜者进入上一级的哪个对局、以哪一侧身份参赛。 */
export function getBracketParent(
  currentDepth: number,
  slot: number,
): { parentSlot: number; side: MatchSide } {
  return { parentSlot: Math.floor(slot / 2), side: slot % 2 === 0 ? 'A' : 'B' };
}

export const MATCH_RULES = [
  {
    code: 'SIX_GAMES_6_TB',
    label: '6局抢先(6:6抢7)',
    shortLabel: '6局抢7',
    targetGames: 6,
    majorLead: 2,
    tiebreakAt: 6,
    tiebreakMinPoints: 7,
  },
  {
    code: 'FOUR_GAMES_4_TB',
    label: '4局抢先(3:3抢7)',
    shortLabel: '4局抢7',
    targetGames: 4,
    majorLead: 2,
    tiebreakAt: 3,
    tiebreakMinPoints: 7,
  },
  {
    code: 'ONE_GAME',
    label: '一局决胜',
    shortLabel: '1局',
    targetGames: 1,
    majorLead: 1,
    tiebreakAt: null,
    tiebreakMinPoints: 0,
  },
] as const;
export type MatchRuleCode = (typeof MATCH_RULES)[number]['code'];
export type MatchRule = (typeof MATCH_RULES)[number];

export function getMatchRule(code: string): MatchRule {
  return MATCH_RULES.find((rule) => rule.code === code) ?? MATCH_RULES[0];
}

function isValidTiebreak(tiebreakMinPoints: number, a: number, b: number): boolean {
  const higher = Math.max(a, b);
  const lower = Math.min(a, b);
  return higher >= tiebreakMinPoints && higher - lower >= 2;
}

/**
 * 校验单打比分。返回 completed=false 表示比分尚未分出胜负（不允许作为终局录入）。
 * 抢七情境下 gamesA===gamesB===tiebreakAt，由抢七小分决出胜者。
 */
export function getSinglesScoreError(
  rule: MatchRule,
  gamesA: number,
  gamesB: number,
  tiebreakA?: number | null,
  tiebreakB?: number | null,
): { ok: boolean; message: string; completed: boolean; winnerSide: MatchSide | null } {
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0) {
    return { ok: false, message: '局数必须是非负整数', completed: false, winnerSide: null };
  }
  if (gamesA === gamesB && rule.tiebreakAt !== null && gamesA === rule.tiebreakAt) {
    const tbA = tiebreakA ?? null;
    const tbB = tiebreakB ?? null;
    if (
      tbA === null ||
      tbB === null ||
      !Number.isInteger(tbA) ||
      !Number.isInteger(tbB) ||
      tbA < 0 ||
      tbB < 0
    ) {
      return {
        ok: false,
        message: '平局落至抢七时需要填写双方小分',
        completed: false,
        winnerSide: null,
      };
    }
    if (!isValidTiebreak(rule.tiebreakMinPoints, tbA, tbB)) {
      return {
        ok: false,
        message: `抢七至少 ${rule.tiebreakMinPoints} 分且至少领先 2 分`,
        completed: false,
        winnerSide: null,
      };
    }
    return {
      ok: true,
      message: '',
      completed: true,
      winnerSide: tbA > tbB ? 'A' : 'B',
    };
  }
  const lead = Math.abs(gamesA - gamesB) >= rule.majorLead;
  const reachedTarget =
    gamesA >= rule.targetGames && gamesB >= rule.targetGames
      ? true
      : Math.max(gamesA, gamesB) >= rule.targetGames;
  if (reachedTarget && lead) {
    return { ok: true, message: '', completed: true, winnerSide: gamesA > gamesB ? 'A' : 'B' };
  }
  return {
    ok: true,
    message: '',
    completed: false,
    winnerSide: null,
  };
}

/** 规范化输入比分：抢七时统一为 games 相等 + 记录小分。 */
export function normalizeSinglesScore(
  gamesA: number,
  gamesB: number,
  tiebreakA?: number | null,
  tiebreakB?: number | null,
): { gamesA: number; gamesB: number; tiebreakA: number | null; tiebreakB: number | null } {
  if (gamesA === gamesB) {
    return {
      gamesA,
      gamesB,
      tiebreakA: tiebreakA ?? null,
      tiebreakB: tiebreakB ?? null,
    };
  }
  return { gamesA, gamesB, tiebreakA: null, tiebreakB: null };
}

export type RoundPair<T> = [T, T];

/**
 * 单循环赛程（伯格轮转法）：每名选手与其余选手恰好交手一次。
 * 奇数选手时插入 null 空位，每轮产生轮空。返回轮次数组，每轮为对局对。
 */
export function generateRoundRobin<T>(players: readonly T[]): RoundPair<T>[][] {
  if (players.length < 2) return [];
  const filled = players.length % 2 === 1 ? [...players, null as unknown as T] : [...players];
  const rounds: RoundPair<T>[][] = [];
  const arr = [...filled];
  for (let round = 0; round < filled.length - 1; round += 1) {
    const pairs: RoundPair<T>[] = [];
    for (let i = 0; i < filled.length / 2; i += 1) {
      const a = arr[i];
      const b = arr[filled.length - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    const last = arr[filled.length - 1];
    arr.splice(1, 0, last);
    arr.pop();
  }
  return rounds;
}

/** 将选手等量分组：返回每个小组的选手列表。 */
export function splitIntoGroups<T>(players: readonly T[], groupCount: number): T[][] {
  if (groupCount <= 0) throw new Error('分组数必须大于 0');
  const perGroup = Math.ceil(players.length / groupCount);
  const groups: T[][] = [];
  for (let g = 0; g < groupCount; g += 1) {
    groups.push(players.slice(g * perGroup, (g + 1) * perGroup));
  }
  return groups;
}

/** 小组内单循环：返回每组对局轮次（轮次内跨组并行）。 */
export function generateGroupRoundRobin<T>(
  groups: readonly (readonly T[])[],
): { groupNumber: number; roundPairs: RoundPair<T>[][] }[] {
  const maxRounds = Math.max(0, ...groups.map((group) => generateRoundRobin(group).length));
  return groups.map((group, index) => {
    const rounds = generateRoundRobin(group);
    const padded: RoundPair<T>[][] = [];
    for (let r = 0; r < maxRounds; r += 1) {
      padded.push(rounds[r] ?? []);
    }
    return { groupNumber: index + 1, roundPairs: padded };
  });
}

/**
 * 小组赛出线名单（按种子顺序）：
 * 先按小组依次取各组头名，再依次取各组次名，依此类推。
 */
export function buildQualifierSeeds(
  groups: readonly (readonly { signupId: string }[])[],
  qualifyPerGroup: number,
): string[] {
  if (groups.length === 0) return [];
  const max = Math.max(0, ...groups.map((group) => group.length));
  const seeds: string[] = [];
  for (let slot = 0; slot < Math.min(max, qualifyPerGroup); slot += 1) {
    for (const group of groups) {
      const signup = group[slot];
      if (signup) seeds.push(signup.signupId);
    }
  }
  return seeds;
}

/**
 * 构建淘汰赛首轮对局：种子列表按“首尾配对、渐次聚拢”的方式落位，
 * 保证小组头名首轮面对不同小组的次名，且同组选手不会在首轮相遇。
 * 返回 [{ stage, slot, seedA, seedB|null }]。
 */
export function buildKnockoutPairs(seeds: readonly string[]): {
  stage: MatchStage;
  slot: number;
  seedA: string;
  seedB: string | null;
}[] {
  const size = seeds.length;
  if (size < 2) return [];
  const stages = getKnockoutStages(size);
  const initialStage = stages[0];
  const pairs: { stage: MatchStage; slot: number; seedA: string; seedB: string | null }[] = [];
  const half = size / 2;
  for (let i = 0; i < half; i += 1) {
    const seedB = i === half - 1 - i ? null : seeds[half - 1 - i];
    pairs.push({ stage: initialStage, slot: i, seedA: seeds[i], seedB });
  }
  return pairs;
}

/** 淘汰赛对齐赛程计算：给定每轮总场次与可用场地数，把对局均匀分配到场地。 */
export function assignCourtLabels(matchCount: number, courtCount: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < matchCount; i += 1) {
    const number = courtCount > 0 ? (i % courtCount) + 1 : i + 1;
    labels.push(`${number}号场`);
  }
  return labels;
}

export interface AuthUserResponse {
  id: string;
  createdAt: string;
  name: string | null;
  phone: string;
  avatarUrl: string | null;
  gender: ParticipantGender | null;
  role: UserRole;
  profileCompleted: boolean;
}

export interface AuthSessionResponse {
  token: string;
  expiresAt: string;
  user: AuthUserResponse;
}

export interface WechatPhoneLoginRequest {
  loginCode: string;
  phoneCode: string;
}

export interface DevLoginRequest {
  userId?: string;
  phone?: string;
  name?: string;
  role?: UserRole;
}

export interface UpdateAuthProfileRequest {
  name?: string;
  avatarUrl?: string;
  gender?: ParticipantGender;
}

export interface AvatarUploadResponse {
  avatarUrl: string;
}

export interface AdminUserItemResponse {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AdminUserListResponse {
  items: AdminUserItemResponse[];
  total: number;
  page: number;
  pageSize: number;
  summary: { totalUsers: number; adminCount: number };
}

export interface SetRoleResponse {
  userId: string;
  role: string;
}

export interface ActivitySignupResponse {
  id: string;
  userId: string | null;
  participantName: string;
  gender: ParticipantGender | null;
  status: SignupStatus;
  isMe: boolean;
  createdAt: string;
}

export interface ActivityListItemResponse {
  id: string;
  title: string;
  mode: ActivityMode;
  status: ActivityStatus;
  signupStartAt: string;
  startAt: string;
  endAt: string;
  locationName: string;
  courtCount: number;
  maxPlayers: number;
  signupCount: number;
  waitlistedCount: number;
  schedulePublished: boolean;
  coverImageUrl: string | null;
}

export interface ActivityListResponse {
  items: ActivityListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export type ActivityListFilter = 'ALL' | 'UPCOMING' | 'ONGOING' | 'FINISHED';

export interface ActivityDetailResponse {
  id: string;
  title: string;
  note: string | null;
  coverImageUrl: string | null;
  mode: ActivityMode;
  status: ActivityStatus;
  signupStartAt: string;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string;
  latitude: number | null;
  longitude: number | null;
  venue: string | null;
  maxPlayers: number;
  courtCount: number;
  warmupMinutes: number;
  matchRuleCode: MatchRuleCode;
  groupCount: number | null;
  qualifyPerGroup: number | null;
  enableThirdPlace: boolean | null;
  creatorName: string | null;
  isCreator: boolean;
  canManage: boolean;
  signupCount: number;
  waitlistedCount: number;
  schedulePublished: boolean;
  mySignup: ActivitySignupResponse | null;
  signups: ActivitySignupResponse[];
  createdAt: string;
}

export interface CreateActivityRequest {
  title?: string;
  mode: ActivityMode;
  signupStartAt: string;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string;
  latitude?: number;
  longitude?: number;
  venue?: string;
  note?: string;
  courtCount: number;
  maxPlayers: number;
  warmupMinutes?: number;
  matchRuleCode?: MatchRuleCode;
  groupCount?: number;
  qualifyPerGroup?: number;
  enableThirdPlace?: boolean;
}

export type UpdateActivityRequest = Partial<Omit<CreateActivityRequest, 'mode'>>;

export interface SignupActivityRequest {
  participantName?: string;
  gender?: ParticipantGender;
}

export interface SignupActivityResponse {
  signup: ActivitySignupResponse;
}

export interface DeleteMySignupResponse {
  signupId: string;
}

export interface MatchPlayerResponse {
  signupId: string;
  userId: string | null;
  participantName: string;
  gender: ParticipantGender | null;
  avatarUrl: string | null;
}

export interface ActivityMatchResponse {
  id: string;
  roundId: string | null;
  stage: MatchStage | null;
  groupNumber: number | null;
  bracketSlot: number | null;
  courtName: string | null;
  startAt: string | null;
  endAt: string | null;
  playerA: MatchPlayerResponse | null;
  playerB: MatchPlayerResponse | null;
  playerAGames: number | null;
  playerBGames: number | null;
  playerATiebreakPoints: number | null;
  playerBTiebreakPoints: number | null;
  winnerId: string | null;
  recordStatus: MatchScoreRecordStatus;
  confirmationState: MatchScoreConfirmationState;
  scoreUpdatedAt: string | null;
  scoreSubmittedSide: MatchSide | null;
  mySide: MatchSide | null;
}

export interface ActivityRoundResponse {
  roundId: string;
  roundNumber: number;
  matches: ActivityMatchResponse[];
}

export interface ScheduleResponse {
  published: boolean;
  rounds: ActivityRoundResponse[];
  knockout: ActivityMatchResponse[];
  thirdPlace: ActivityMatchResponse | null;
}

export interface SaveMatchScoreRequest {
  playerAGames: number;
  playerBGames: number;
  playerATiebreakPoints?: number;
  playerBTiebreakPoints?: number;
}

export interface SaveMatchScoreResponse {
  match: ActivityMatchResponse;
}

export interface ConfirmMatchScoreResponse {
  match: ActivityMatchResponse;
}

export interface DisputeMatchScoreRequest {
  reason: string;
}

export interface ArbitrateMatchScoreRequest {
  playerAGames: number;
  playerBGames: number;
  playerATiebreakPoints?: number;
  playerBTiebreakPoints?: number;
  reason?: string;
}

export interface MarkUnplayedRequest {
  reason?: string;
}

export interface StandingRowResponse {
  signupId: string;
  participantName: string;
  avatarUrl: string | null;
  gender: ParticipantGender | null;
  played: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  rank: number;
  qualified: boolean;
  isMe: boolean;
}

export interface RoundRobinStandingsResponse {
  rows: StandingRowResponse[];
  completed: boolean;
}

export interface GroupStandingsResponse {
  groups: { groupNumber: number; rows: StandingRowResponse[] }[];
}

export interface KnockoutBracketResponse {
  stages: { stage: MatchStage; matches: ActivityMatchResponse[] }[];
  thirdPlace: ActivityMatchResponse | null;
  champion: MatchPlayerResponse | null;
  runnerUp: MatchPlayerResponse | null;
}

export interface MyMatchItemResponse {
  matchId: string;
  activityId: string;
  activityTitle: string;
  stage: MatchStage | null;
  roundNumber: number | null;
  courtName: string | null;
  myParticipantName: string;
  opponentName: string;
  opponentAvatarUrl: string | null;
  myGames: number | null;
  opponentGames: number | null;
  isWinner: boolean | null;
  recordStatus: MatchScoreRecordStatus;
  confirmationState: MatchScoreConfirmationState;
  startAt: string | null;
}

export interface MyMatchListResponse {
  items: MyMatchItemResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MySignupRecordResponse {
  signupId: string;
  activityId: string;
  activityTitle: string;
  mode: ActivityMode;
  status: ActivityStatus;
  signupStatus: SignupStatus;
  startAt: string;
  endAt: string;
  locationName: string;
  schedulePublished: boolean;
}

export interface MySignupListResponse {
  items: MySignupRecordResponse[];
  total: number;
  page: number;
  pageSize: number;
}
