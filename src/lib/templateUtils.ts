/**
 * Replaces all {{VARIABLE_NAME}} placeholders with provided values.
 * Extracted here so client components can import it without pulling in prisma.
 */
export function substituteVariables(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, varName: string) => {
    return Object.prototype.hasOwnProperty.call(vars, varName) ? vars[varName] : match
  })
}