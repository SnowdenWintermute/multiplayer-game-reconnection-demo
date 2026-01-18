import { RandomNumberUtils } from "./random-numbers.js";

export class ArrayUtils {
  static chooseRandom<T>(arr: T[]): Error | T {
    if (arr.length < 1) return new Error("Array is empty");
    const randomIndex = RandomNumberUtils.randBetween(0, arr.length - 1);
    const randomMember = arr[randomIndex];
    if (randomMember === undefined)
      return new Error("Somehow randomly chose undefined from array");
    return randomMember;
  }
}
