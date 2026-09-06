import type { ActivityMatch, ActivitySignup } from '../../generated/prisma/client';
import type { ActivityMatchResponse, MatchPlayerResponse, MatchSide } from '@ntr/shared';

type SignupWithUser = ActivitySignup & {
  user?: { avatarUrl?: string | null } | null;
};

export type MatchWithPlayers = ActivityMatch & {
  playerA: SignupWithUser | null;
  playerB: SignupWithUser | null;
};

export function mapMatchPlayer(signup: SignupWithUser | null): MatchPlayerResponse | null {
  if (!signup) return null;
  return {
    signupId: signup.id,
    userId: signup.userId,
    participantName: signup.participantName,
    gender: signup.gender,
    avatarUrl: signup.user?.avatarUrl ?? null,
  };
}

export function mapActivityMatch(
  match: MatchWithPlayers,
  meUserId?: string | null,
): ActivityMatchResponse {
  const playerA = mapMatchPlayer(match.playerA);
  const playerB = mapMatchPlayer(match.playerB);
  let mySide: MatchSide | null = null;
  if (meUserId) {
    if (playerA && playerA.userId === meUserId) mySide = 'A';
    else if (playerB && playerB.userId === meUserId) mySide = 'B';
  }
  return {
    id: match.id,
    roundId: match.roundId,
    stage: match.stage,
    groupNumber: match.groupNumber,
    bracketSlot: match.bracketSlot,
    courtName: match.courtName,
    startAt: match.startAt?.toISOString() ?? null,
    endAt: match.endAt?.toISOString() ?? null,
    playerA,
    playerB,
    playerAGames: match.playerAGames,
    playerBGames: match.playerBGames,
    playerATiebreakPoints: match.playerATiebreakPoints,
    playerBTiebreakPoints: match.playerBTiebreakPoints,
    winnerId: match.winnerId,
    recordStatus: match.recordStatus,
    confirmationState: match.confirmationState,
    scoreUpdatedAt: match.scoreUpdatedAt?.toISOString() ?? null,
    scoreSubmittedSide: match.scoreSubmittedSide,
    mySide,
  };
}

/** 标准 join 配置：带双方球员及其昵称/头像。 */
export const matchInclude = {
  playerA: { include: { user: { select: { avatarUrl: true } } } },
  playerB: { include: { user: { select: { avatarUrl: true } } } },
} as const;
