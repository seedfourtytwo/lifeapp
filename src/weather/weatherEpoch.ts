/** Invalidates in-flight weather cache/snapshot writers across clear/import/disable. */

let weatherDataEpoch = 0;

export function bumpWeatherDataEpoch(): void {
  weatherDataEpoch += 1;
}

export function getWeatherDataEpoch(): number {
  return weatherDataEpoch;
}
