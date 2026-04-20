let _counter = 0;

/**
 * Generate a short unique ID with optional prefix.
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
}
