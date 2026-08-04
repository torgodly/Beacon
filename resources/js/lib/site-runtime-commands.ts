export type SiteRuntimeType = 'laravel' | 'nextjs' | 'nuxt' | 'static';

type RuntimeSite = {
    type: string;
    path: string;
    php_version?: string | null;
    package_manager?: string | null;
};

export function siteRuntimeType(type: string): SiteRuntimeType {
    if (type === 'laravel' || type === 'nextjs' || type === 'nuxt' || type === 'static') {
        return type;
    }

    return 'static';
}

export function phpBinary(site: RuntimeSite): string {
    return site.php_version ? `php${site.php_version}` : 'php';
}

export function packageManager(site: RuntimeSite): 'npm' | 'bun' {
    return site.package_manager === 'bun' ? 'bun' : 'npm';
}

export function siteHasConsoleTab(type: string): boolean {
    return ['laravel', 'nextjs', 'nuxt'].includes(type);
}

export function siteHasSupervisorTab(type: string): boolean {
    return ['laravel', 'nextjs', 'nuxt'].includes(type);
}

export function siteHasLaravelScheduler(type: string): boolean {
    return type === 'laravel';
}

export function siteHasConfigCacheOnSave(type: string): boolean {
    return type === 'laravel';
}

export function defaultConsoleCommand(site: RuntimeSite): string {
    switch (siteRuntimeType(site.type)) {
        case 'laravel':
            return `${phpBinary(site)} ${site.path}/artisan --version`;
        case 'nextjs':
            return `cd ${site.path} && ${packageManager(site)} run build`;
        case 'nuxt':
            return `cd ${site.path} && ${packageManager(site)} run build`;
        default:
            return `cd ${site.path}`;
    }
}

export function consoleCommandPlaceholder(site: RuntimeSite): string {
    switch (siteRuntimeType(site.type)) {
        case 'laravel':
            return `${phpBinary(site)} ${site.path}/artisan migrate`;
        case 'nextjs':
            return `cd ${site.path} && ${packageManager(site)} run start`;
        case 'nuxt':
            return `cd ${site.path} && node .output/server/index.mjs`;
        default:
            return `cd ${site.path} && ls -la`;
    }
}

export function defaultCronCommand(site: RuntimeSite): string {
    switch (siteRuntimeType(site.type)) {
        case 'laravel':
            return `${phpBinary(site)} ${site.path}/artisan inspire`;
        case 'nextjs':
            return `cd ${site.path} && ${packageManager(site)} run build`;
        case 'nuxt':
            return `cd ${site.path} && ${packageManager(site)} run build`;
        default:
            return `cd ${site.path}`;
    }
}

export function defaultSupervisorCommand(site: RuntimeSite): string {
    switch (siteRuntimeType(site.type)) {
        case 'laravel':
            return `${phpBinary(site)} ${site.path}/artisan queue:work`;
        case 'nextjs':
            return `cd ${site.path} && ${packageManager(site)} run start`;
        case 'nuxt':
            return `cd ${site.path} && node .output/server/index.mjs`;
        default:
            return `cd ${site.path}`;
    }
}

export function defaultSupervisorProcessKind(
    type: string,
): 'queue_worker' | 'custom' {
    return siteRuntimeType(type) === 'laravel' ? 'queue_worker' : 'custom';
}

export function supervisorProcessTabOptions(type: string): Array<{
    value: 'queue_worker' | 'custom';
    label: string;
}> {
    if (siteRuntimeType(type) === 'laravel') {
        return [
            { value: 'queue_worker', label: 'Queue worker' },
            { value: 'custom', label: 'Custom' },
        ];
    }

    return [{ value: 'custom', label: 'Custom process' }];
}

export function consoleSuggestedCommands(site: RuntimeSite): string[] {
    switch (siteRuntimeType(site.type)) {
        case 'laravel':
            return [
                `${phpBinary(site)} ${site.path}/artisan migrate --force`,
                `${phpBinary(site)} ${site.path}/artisan optimize:clear`,
                `${phpBinary(site)} ${site.path}/artisan queue:restart`,
            ];
        case 'nextjs':
            return [
                `cd ${site.path} && ${packageManager(site)} run build`,
                `cd ${site.path} && ${packageManager(site)} run start`,
                `cd ${site.path} && ${packageManager(site)} run lint`,
            ];
        case 'nuxt':
            return [
                `cd ${site.path} && ${packageManager(site)} run build`,
                `cd ${site.path} && node .output/server/index.mjs`,
                `cd ${site.path} && ${packageManager(site)} run preview`,
            ];
        default:
            return [];
    }
}
