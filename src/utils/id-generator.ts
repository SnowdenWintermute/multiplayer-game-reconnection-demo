import { v4 as uuidv4 } from "uuid";

export class IdGenerator<T extends string> {
  constructor() {}

  generate(): T {
    const id = uuidv4();
    return id as T;
  }
}
