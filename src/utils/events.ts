/** Sum event values for daily aggregation (counters, timer habits). */
export function sumEventValues(events: readonly { value: number }[]): number {
  return events.reduce((sum, event) => sum + event.value, 0);
}
