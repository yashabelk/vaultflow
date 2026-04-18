export function nanoid(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length)
}
