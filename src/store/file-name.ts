/** Names of the files the app produces (pure). */

/** File name of a shared drawing: `<prefix>-YYYY-MM-DD-HHMMSS.png`, local time (seconds keep
 * two drawings of the same minute apart). */
export function drawingFileName(prefix: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${prefix}-${stamp}.png`;
}
