import {
  ACTIVITY_MODES,
  KNOCKOUT_STAGE_LABELS,
  type ActivityMode,
  type ActivityStatus,
  type MatchStage,
} from '@ntr/shared';

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatClock(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${formatClock(date)}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${datePart(start)} ${formatClock(start)} - ${formatClock(end)}`;
  }
  return `${shortDate(start)} ${formatClock(start)} - ${shortDate(end)} ${formatClock(end)}`;
}

function datePart(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function shortDate(date: Date): string {
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

export type ActivityPhase = 'UPCOMING' | 'ONGOING' | 'FINISHED';

export function getActivityPhase(
  startIso: string,
  endIso: string,
  now = new Date(),
): ActivityPhase {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (now < start) return 'UPCOMING';
  if (now > end) return 'FINISHED';
  return 'ONGOING';
}

export const PHASE_LABEL: Record<ActivityPhase, string> = {
  UPCOMING: '未开始',
  ONGOING: '进行中',
  FINISHED: '已结束',
};

export function activityStatusText(status: ActivityStatus): string {
  return status === 'CANCELED' ? '已取消' : '';
}

export function modeLabel(mode: ActivityMode): string {
  return mode === ACTIVITY_MODES.ROUND_ROBIN ? '单打循环赛' : '单打淘汰赛';
}

export function stageLabel(stage: MatchStage): string {
  return KNOCKOUT_STAGE_LABELS[stage] ?? stage;
}

/** W 场 / N 号场 等场馆文本。 */
export function courtText(courtName?: string | null): string {
  return courtName || '待定场地';
}
