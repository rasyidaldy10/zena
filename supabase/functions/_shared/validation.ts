/**
 * INPUT VALIDATION
 * Elite Security: Prevent Injection Attacks
 *
 * Validates and sanitizes all user inputs before processing
 * - SQL injection prevention
 * - XSS prevention
 * - Path traversal prevention
 * - Command injection prevention
 */

/**
 * UUID v4 validation (strict)
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUID(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  return UUID_REGEX.test(value)
}

export function validateUUID(value: unknown, fieldName = 'UUID'): string {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid ${fieldName} format`)
  }
  return value
}

/**
 * String validation (prevent injection)
 */
export function validateString(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number
    maxLength?: number
    pattern?: RegExp
    allowEmpty?: boolean
  } = {}
): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }

  const trimmed = value.trim()

  if (!options.allowEmpty && trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`)
  }

  if (options.minLength && trimmed.length < options.minLength) {
    throw new Error(`${fieldName} must be at least ${options.minLength} characters`)
  }

  if (options.maxLength && trimmed.length > options.maxLength) {
    throw new Error(`${fieldName} must be at most ${options.maxLength} characters`)
  }

  if (options.pattern && !options.pattern.test(trimmed)) {
    throw new Error(`${fieldName} format is invalid`)
  }

  // Check for dangerous characters (SQL injection, XSS)
  const dangerousPatterns = [
    /['";]/,           // SQL injection quotes
    /<script/i,        // XSS script tags
    /javascript:/i,    // XSS javascript protocol
    /on\w+=/i,         // XSS event handlers
    /\.\.\//,          // Path traversal
    /\x00/,            // Null byte injection
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      throw new Error(`${fieldName} contains invalid characters`)
    }
  }

  return trimmed
}

/**
 * Enum validation
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fieldName: string
): T {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }

  if (!allowedValues.includes(value as T)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`
    )
  }

  return value as T
}

/**
 * Number validation
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: {
    min?: number
    max?: number
    integer?: boolean
  } = {}
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a number`)
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`)
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}`)
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`${fieldName} must be at most ${options.max}`)
  }

  return value
}

/**
 * Date validation
 */
export function validateDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`)
  }

  const date = new Date(value)

  if (isNaN(date.getTime())) {
    throw new Error(`${fieldName} is not a valid date`)
  }

  return date
}

/**
 * Object validation (prevent prototype pollution)
 */
export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  fieldName: string
): T {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`)
  }

  // Prevent prototype pollution
  const obj = value as Record<string, unknown>

  if ('__proto__' in obj || 'constructor' in obj || 'prototype' in obj) {
    throw new Error(`${fieldName} contains forbidden keys`)
  }

  return obj as T
}

/**
 * Array validation
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number
    maxLength?: number
    itemValidator?: (item: unknown, index: number) => T
  } = {}
): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`)
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new Error(`${fieldName} must have at least ${options.minLength} items`)
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new Error(`${fieldName} must have at most ${options.maxLength} items`)
  }

  if (options.itemValidator) {
    return value.map((item, index) => options.itemValidator!(item, index))
  }

  return value as T[]
}

/**
 * Sanitize HTML (prevent XSS)
 */
export function sanitizeHTML(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate OAuth action type
 */
export type OAuthAction = 'exchange' | 'refresh' | 'revoke' | 'get-accounts' | 'get-transactions'

export function validateOAuthAction(value: unknown): OAuthAction {
  return validateEnum(
    value,
    ['exchange', 'refresh', 'revoke', 'get-accounts', 'get-transactions'] as const,
    'action'
  )
}

/**
 * Validate request body structure
 */
export function validateRequestBody<T extends Record<string, unknown>>(
  body: unknown,
  requiredFields: (keyof T)[]
): T {
  const obj = validateObject<T>(body, 'request body')

  for (const field of requiredFields) {
    if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
      throw new Error(`Missing required field: ${String(field)}`)
    }
  }

  return obj
}

/**
 * Validate Brick OAuth parameters
 */
export interface BrickOAuthExchangeParams {
  action: 'exchange'
  code: string
  userId: string
  state: string
}

export interface BrickOAuthRefreshParams {
  action: 'refresh'
  connectionId: string
}

export interface BrickOAuthRevokeParams {
  action: 'revoke'
  connectionId: string
}

export interface BrickOAuthGetAccountsParams {
  action: 'get-accounts'
  connectionId: string
}

export interface BrickOAuthGetTransactionsParams {
  action: 'get-transactions'
  connectionId: string
  fromDate?: string
  toDate?: string
}

export type BrickOAuthParams =
  | BrickOAuthExchangeParams
  | BrickOAuthRefreshParams
  | BrickOAuthRevokeParams
  | BrickOAuthGetAccountsParams
  | BrickOAuthGetTransactionsParams

export function validateBrickOAuthParams(body: unknown): BrickOAuthParams {
  const obj = validateObject<Record<string, unknown>>(body, 'request body')

  const action = validateOAuthAction(obj.action)

  switch (action) {
    case 'exchange':
      return {
        action,
        code: validateString(obj.code, 'code', { maxLength: 500 }),
        userId: validateUUID(obj.userId, 'userId'),
        state: validateString(obj.state, 'state', { maxLength: 100 })
      }

    case 'refresh':
    case 'revoke':
    case 'get-accounts':
      return {
        action,
        connectionId: validateUUID(obj.connectionId, 'connectionId')
      }

    case 'get-transactions':
      const params: BrickOAuthGetTransactionsParams = {
        action,
        connectionId: validateUUID(obj.connectionId, 'connectionId')
      }

      if (obj.fromDate) {
        validateDate(obj.fromDate, 'fromDate')
        params.fromDate = obj.fromDate as string
      }

      if (obj.toDate) {
        validateDate(obj.toDate, 'toDate')
        params.toDate = obj.toDate as string
      }

      return params

    default:
      throw new Error(`Unknown action: ${action}`)
  }
}
