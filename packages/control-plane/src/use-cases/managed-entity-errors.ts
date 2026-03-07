export class ManagedEntityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagedEntityConflictError";
  }
}

export class ManagedEntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManagedEntityNotFoundError";
  }
}
