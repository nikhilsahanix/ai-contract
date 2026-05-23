export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export class AuthError extends AppError {
  constructor(code: string, message: string, statusCode = 401) {
    super(code, statusCode, message);
  }
}
