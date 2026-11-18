export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const required = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'] as const;
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Faltam variáveis de banco no ambiente: ${missing.join(', ')}`);

  const user = encodeURIComponent(env.POSTGRES_USER!);
  const password = encodeURIComponent(env.POSTGRES_PASSWORD!);
  const host = env.POSTGRES_HOST || 'localhost';
  const port = env.POSTGRES_PORT || '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${env.POSTGRES_DB}`;
}
