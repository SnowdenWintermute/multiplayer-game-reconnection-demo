import { ERROR_MESSAGES } from "../error-messages.js";

export function invariant(
  condition: boolean,
  message?: string
): asserts condition {
  if (!condition) {
    console.trace();
    throw new Error(
      `${ERROR_MESSAGES.INVARIANT_FALED}${message ? `: ${message}` : ""}`
    );
  }
}
