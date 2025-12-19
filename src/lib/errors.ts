// Structured error codes for API responses

export const ErrorCode = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_MESSAGE_FORMAT: "INVALID_MESSAGE_FORMAT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Authentication/Authorization errors (401/403)
  CSRF_VALIDATION_FAILED: "CSRF_VALIDATION_FAILED",
  INVALID_API_KEY: "INVALID_API_KEY",
  UNAUTHORIZED: "UNAUTHORIZED",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // External service errors (502/503)
  PLEX_CONNECTION_FAILED: "PLEX_CONNECTION_FAILED",
  PLEX_API_ERROR: "PLEX_API_ERROR",
  GEMINI_API_ERROR: "GEMINI_API_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Internal errors (500)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  STREAMING_ERROR: "STREAMING_ERROR",
  TOOL_EXECUTION_ERROR: "TOOL_EXECUTION_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  error: string;
  code: ErrorCodeType;
  details?: string;
  retryAfter?: number;
}

export function createError(
  code: ErrorCodeType,
  message: string,
  details?: string
): ApiError {
  return {
    error: message,
    code,
    ...(details && { details }),
  };
}

export function createRateLimitError(retryAfter: number): ApiError {
  return {
    error: "Too many requests. Please wait before trying again.",
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    retryAfter,
  };
}

// Map HTTP status codes to appropriate error responses
export function getErrorResponse(
  code: ErrorCodeType,
  message: string,
  details?: string
): { body: ApiError; status: number } {
  const body = createError(code, message, details);

  let status: number;
  switch (code) {
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_MESSAGE_FORMAT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
      status = 400;
      break;
    case ErrorCode.CSRF_VALIDATION_FAILED:
    case ErrorCode.UNAUTHORIZED:
      status = 403;
      break;
    case ErrorCode.INVALID_API_KEY:
      status = 401;
      break;
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      status = 429;
      break;
    case ErrorCode.PLEX_CONNECTION_FAILED:
    case ErrorCode.EXTERNAL_SERVICE_ERROR:
      status = 502;
      break;
    case ErrorCode.PLEX_API_ERROR:
    case ErrorCode.GEMINI_API_ERROR:
      status = 503;
      break;
    default:
      status = 500;
  }

  return { body, status };
}
