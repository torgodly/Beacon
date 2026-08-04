export const SITE_FRAMEWORK_LABELS: Record<string, string> = {
    laravel: 'Laravel',
    nextjs: 'Next.js',
    nuxt: 'Nuxt',
    static: 'Static',
};

export const SITE_FRAMEWORK_ICON_SRC: Record<string, string> = {
    laravel: '/assets/svgs/laravel.svg',
    nextjs: '/assets/svgs/nextjs.svg',
    nuxt: '/assets/svgs/nuxtjs.svg',
    static: '/assets/svgs/html.svg',
};

export function siteFrameworkLabel(type: string): string {
    return SITE_FRAMEWORK_LABELS[type] ?? type;
}

export function siteFrameworkIconSrc(type: string): string | null {
    return SITE_FRAMEWORK_ICON_SRC[type] ?? null;
}
