import { ApiException } from '@/lib/api/client';

/**
 * Extract a user-friendly error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiException) {
    return error.getMessage();
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // Try to extract message from error object
    if ('detail' in error && typeof error.detail === 'string') {
      return error.detail;
    }
    
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  
  return 'An unexpected error occurred';
}

/**
 * Log error with proper formatting
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  console.error(`[${context}]`, message);
  
  // Log original error if available
  if (error instanceof ApiException && error.originalError) {
    console.error(`[${context}] Original error:`, error.originalError);
  }
  
  // Log full error object in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}] Full error:`, error);
  }
}

