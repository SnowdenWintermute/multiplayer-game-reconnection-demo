import { plainToInstance } from "class-transformer";

export class ReferenceCountedLock<T> {
  private references = new Set<T>();

  static getDeserialized<T>(plain: ReferenceCountedLock<T>) {
    const toReturn = plainToInstance(ReferenceCountedLock<T>, plain);
    toReturn.references = new Set(toReturn.references);
    return toReturn;
  }

  add(reference: T) {
    if (this.references.has(reference)) {
      return;
    }

    this.references.add(reference);
  }

  remove(reference: T) {
    this.references.delete(reference);
  }

  get isLocked() {
    const isLocked = this.references.size > 0;
    return isLocked;
  }
}
