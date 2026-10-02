export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(readonly detail: string) {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfterSec: number) {
    super("Too many attempts");
    this.name = "RateLimitedError";
  }
}
