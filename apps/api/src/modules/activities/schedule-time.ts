export interface TimeSlot {
  startAt: Date;
  endAt: Date;
}

/** 将活动可赛时段（扣除热身）均分为若干时间片，逐片顺延。 */
export function allocateSlots(
  activityStart: Date,
  activityEnd: Date,
  warmupMinutes: number,
  slotCount: number,
): TimeSlot[] {
  if (slotCount <= 0) return [];
  const warmupMs = warmupMinutes * 60 * 1000;
  const spanMs = Math.max(0, activityEnd.getTime() - activityStart.getTime() - warmupMs);
  const perSlotMs = slotCount > 0 ? Math.max(1, Math.floor(spanMs / slotCount)) : 0;
  const base = activityStart.getTime() + warmupMs;
  return Array.from({ length: slotCount }, (_, index) => ({
    startAt: new Date(base + index * perSlotMs),
    endAt: new Date(base + (index + 1) * perSlotMs),
  }));
}

/** 同一对局空间内的场地名，超过场地数时循环使用。 */
export function courtLabel(index: number, courtCount: number): string {
  const number = courtCount > 0 ? (index % courtCount) + 1 : index + 1;
  return `${number}号场`;
}
