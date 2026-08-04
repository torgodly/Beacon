export type AppEnv = 'testing' | 'staging' | 'production';

export function formatAppEnv(env: AppEnv): string {
    return env.charAt(0).toUpperCase() + env.slice(1);
}
