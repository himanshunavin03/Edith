/** Typed application error carrying an HTTP status code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UpstreamError extends AppError {
  constructor(message: string) {
    super(message, 502, 'UPSTREAM_ERROR');
  }
}

export class TimeoutAppError extends AppError {
  constructor(message = 'Upstream request timed out') {
    super(message, 504, 'TIMEOUT');
  }
}
