/** Presentation only: keep the stored role name and identifiers unchanged. */
export function displayRoleName(value: string | null | undefined): string {
  if (!value) return '';
  // Nexora company-scoped roles use a CUID inside a trailing bracket.
  return value.replace(/\s+\[cm[a-z0-9]{12,}\]$/i, '').trim();
}

export function displayRoleNames(values: readonly string[]): string {
  return values.map(displayRoleName).filter(Boolean).join(', ');
}
