-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ParticipantGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ActivityMode" AS ENUM ('ROUND_ROBIN', 'GROUP_KNOCKOUT');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PUBLISHED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SignupStatus" AS ENUM ('CONFIRMED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('GROUP', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'FINAL', 'THIRD_PLACE');

-- CreateEnum
CREATE TYPE "MatchSide" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "MatchScoreRecordStatus" AS ENUM ('PENDING', 'COMPLETED', 'UNPLAYED');

-- CreateEnum
CREATE TYPE "MatchScoreConfirmationState" AS ENUM ('NONE', 'NOT_REQUIRED', 'PENDING_CONFIRM', 'CONFIRMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "MatchScoreAuditAction" AS ENUM ('RECORD', 'UPDATE', 'MARK_UNPLAYED', 'CONFIRM', 'DISPUTE', 'ARBITRATE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "wechatOpenId" TEXT,
    "avatarUrl" TEXT,
    "gender" "ParticipantGender",
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "profileCompletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "wechatSessionKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "coverImageUrl" TEXT,
    "mode" "ActivityMode" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PUBLISHED',
    "signupStartAt" TIMESTAMPTZ(3) NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "locationName" TEXT NOT NULL,
    "locationAddress" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "venue" TEXT,
    "maxPlayers" INTEGER NOT NULL,
    "courtCount" INTEGER NOT NULL,
    "warmupMinutes" INTEGER NOT NULL DEFAULT 10,
    "matchRuleCode" TEXT NOT NULL DEFAULT 'SIX_GAMES_6_TB',
    "groupCount" INTEGER,
    "qualifyPerGroup" INTEGER,
    "enableThirdPlace" BOOLEAN,
    "schedulePublishedAt" TIMESTAMPTZ(3),
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySignup" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT,
    "participantName" TEXT NOT NULL,
    "gender" "ParticipantGender",
    "status" "SignupStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivitySignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRound" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityMatch" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "roundId" TEXT,
    "stage" "MatchStage",
    "groupNumber" INTEGER,
    "bracketSlot" INTEGER,
    "courtName" TEXT,
    "startAt" TIMESTAMPTZ(3),
    "endAt" TIMESTAMPTZ(3),
    "playerAId" TEXT,
    "playerBId" TEXT,
    "playerAGames" INTEGER,
    "playerBGames" INTEGER,
    "playerATiebreakPoints" INTEGER,
    "playerBTiebreakPoints" INTEGER,
    "winnerId" TEXT,
    "scoreUpdatedAt" TIMESTAMP(3),
    "scoreSubmittedById" TEXT,
    "scoreSubmittedSide" "MatchSide",
    "recordStatus" "MatchScoreRecordStatus" NOT NULL DEFAULT 'PENDING',
    "confirmationState" "MatchScoreConfirmationState" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityMatchScoreAudit" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "MatchScoreAuditAction" NOT NULL,
    "recordStatusBefore" "MatchScoreRecordStatus",
    "recordStatusAfter" "MatchScoreRecordStatus" NOT NULL,
    "playerAGamesBefore" INTEGER,
    "playerBGamesBefore" INTEGER,
    "playerATiebreakPointsBefore" INTEGER,
    "playerBTiebreakPointsBefore" INTEGER,
    "playerAGamesAfter" INTEGER,
    "playerBGamesAfter" INTEGER,
    "playerATiebreakPointsAfter" INTEGER,
    "playerBTiebreakPointsAfter" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityMatchScoreAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityMatchScoreConfirmation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scoreUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityMatchScoreConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Activity_startAt_createdAt_idx" ON "Activity"("startAt", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_creatorId_idx" ON "Activity"("creatorId");

-- CreateIndex
CREATE INDEX "ActivitySignup_activityId_status_createdAt_idx" ON "ActivitySignup"("activityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivitySignup_userId_idx" ON "ActivitySignup"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySignup_activityId_participantName_key" ON "ActivitySignup"("activityId", "participantName");

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySignup_activityId_userId_key" ON "ActivitySignup"("activityId", "userId");

-- CreateIndex
CREATE INDEX "ActivityRound_activityId_roundNumber_idx" ON "ActivityRound"("activityId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRound_activityId_roundNumber_key" ON "ActivityRound"("activityId", "roundNumber");

-- CreateIndex
CREATE INDEX "ActivityMatch_activityId_idx" ON "ActivityMatch"("activityId");

-- CreateIndex
CREATE INDEX "ActivityMatch_roundId_courtName_idx" ON "ActivityMatch"("roundId", "courtName");

-- CreateIndex
CREATE INDEX "ActivityMatch_activityId_stage_bracketSlot_idx" ON "ActivityMatch"("activityId", "stage", "bracketSlot");

-- CreateIndex
CREATE INDEX "ActivityMatch_activityId_recordStatus_idx" ON "ActivityMatch"("activityId", "recordStatus");

-- CreateIndex
CREATE INDEX "ActivityMatchScoreAudit_matchId_createdAt_idx" ON "ActivityMatchScoreAudit"("matchId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityMatchScoreAudit_activityId_createdAt_idx" ON "ActivityMatchScoreAudit"("activityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityMatchScoreConfirmation_userId_createdAt_idx" ON "ActivityMatchScoreConfirmation"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityMatchScoreConfirmation_matchId_userId_key" ON "ActivityMatchScoreConfirmation"("matchId", "userId");

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySignup" ADD CONSTRAINT "ActivitySignup_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySignup" ADD CONSTRAINT "ActivitySignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRound" ADD CONSTRAINT "ActivityRound_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ActivityRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "ActivitySignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "ActivitySignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "ActivitySignup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatch" ADD CONSTRAINT "ActivityMatch_scoreSubmittedById_fkey" FOREIGN KEY ("scoreSubmittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatchScoreAudit" ADD CONSTRAINT "ActivityMatchScoreAudit_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatchScoreAudit" ADD CONSTRAINT "ActivityMatchScoreAudit_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ActivityMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatchScoreAudit" ADD CONSTRAINT "ActivityMatchScoreAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatchScoreConfirmation" ADD CONSTRAINT "ActivityMatchScoreConfirmation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ActivityMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityMatchScoreConfirmation" ADD CONSTRAINT "ActivityMatchScoreConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
