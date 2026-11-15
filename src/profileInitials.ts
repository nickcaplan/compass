// Use the first and last name parts. A single name has one initial.
// Missing names keep the existing email-initial fallback.
export function profileInitials(name: unknown, email: string | null): string {
  const parts = typeof name === 'string' ? name.trim().split(/\s+/u).filter(Boolean) : [];
  const firstLetter = (value: string) => new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)[Symbol.iterator]().next().value?.segment ?? '';
  if (parts.length) return (firstLetter(parts[0]) + (parts.length > 1 ? firstLetter(parts[parts.length - 1]) : '')).toLocaleUpperCase();
  return firstLetter(email?.trim() ?? '').toLocaleUpperCase() || '?';
}
