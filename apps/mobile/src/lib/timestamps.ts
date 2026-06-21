/** Compara timestamps ISO de Postgres/JS sin errores de formato string. */
export function isAfterTimestamp(value: string, since: string): boolean {
  return new Date(value).getTime() > new Date(since).getTime();
}
