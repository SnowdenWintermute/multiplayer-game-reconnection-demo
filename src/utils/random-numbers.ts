export class RandomNumberUtils {
  /** random number between two given numbers, inclusive */
  static randBetween(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
