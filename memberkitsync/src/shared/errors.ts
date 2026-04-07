export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super(`${resource} não encontrado: ${id}`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
  }
}

export class MemberKitApiError extends AppError {
  constructor(message: string, public readonly response?: unknown) {
    super(message, 'MEMBERKIT_API_ERROR', 502)
    this.name = 'MemberKitApiError'
  }
}

export class SupabaseError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super(message, 'SUPABASE_ERROR', 500)
    this.name = 'SupabaseError'
  }
}

export class WebhookValidationError extends AppError {
  constructor(message: string) {
    super(message, 'WEBHOOK_VALIDATION_ERROR', 401)
    this.name = 'WebhookValidationError'
  }
}

export class WebhookSkipError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookSkipError'
  }
}
