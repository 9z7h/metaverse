/** 한국 표준시 기준 낮의 밝기. 해 뜨고 지는 시간은 계절과 무관한 연출 값이다. */
export function gardenDaylight(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const time = hour + minute / 60;
  return Math.max(0, Math.min(1, (time - 6) / 2, (20 - time) / 2));
}
