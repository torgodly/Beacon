import type { ReactNode } from 'react';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import { formatAppEnv, type AppEnv } from '@/lib/site-env';
import { siteFrameworkLabel } from '@/lib/site-framework';
import { cn } from '@/lib/utils';

type SiteMeta = {
    type?: string;
    php_version?: string | null;
    app_env?: AppEnv | null;
};

const chipShell =
    'inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium leading-none';

const envStyles: Record<
    AppEnv,
    { shell: string; dot: string }
> = {
    testing: {
        shell: 'border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-200',
        dot: 'bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]',
    },
    staging: {
        shell: 'border-[#06C8E0]/35 bg-[#ECFDFF] text-[#036672] dark:border-[#22D0E8]/30 dark:bg-[#063543]/50 dark:text-[#7aefff]',
        dot: 'bg-[#06C8E0] shadow-[0_0_0_2px_rgba(6,200,224,0.25)]',
    },
    production: {
        shell: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
        dot: 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]',
    },
};

function MetaChip({
    children,
    className,
    title,
}: {
    children: ReactNode;
    className?: string;
    title?: string;
}) {
    return (
        <span
            title={title}
            className={cn(
                chipShell,
                'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] dark:border-[#334155] dark:bg-[#151718] dark:text-[#CBD5E1]',
                className,
            )}
        >
            {children}
        </span>
    );
}

function EnvChip({ env }: { env: AppEnv }) {
    const styles = envStyles[env];
    const label = formatAppEnv(env);

    return (
        <span
            title={`Environment: ${label}`}
            className={cn(chipShell, styles.shell)}
        >
            <span
                aria-hidden="true"
                className={cn('size-1.5 shrink-0 rounded-full', styles.dot)}
            />
            <span className="truncate">{label}</span>
        </span>
    );
}

export function SiteMetaBadges({
    site,
    layout = 'inline',
    className,
}: {
    site: SiteMeta;
    layout?: 'inline' | 'stack';
    className?: string;
}) {
    const chips: ReactNode[] = [];

    if (site.type) {
        chips.push(
            <MetaChip key="framework" title={siteFrameworkLabel(site.type)}>
                <SiteFrameworkIcon type={site.type} size="sm" />
                <span className="truncate">{siteFrameworkLabel(site.type)}</span>
            </MetaChip>,
        );
    }

    if (site.php_version) {
        chips.push(
            <MetaChip key="php" title={`PHP ${site.php_version}`}>
                <span className="truncate font-mono">PHP {site.php_version}</span>
            </MetaChip>,
        );
    }

    if (site.type === 'laravel' && site.app_env) {
        chips.push(<EnvChip key="env" env={site.app_env} />);
    }

    if (chips.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                layout === 'inline' &&
                    'flex max-w-full flex-wrap items-center gap-1.5',
                layout === 'stack' && 'flex max-w-full flex-col items-start gap-1.5',
                className,
            )}
        >
            {chips}
        </div>
    );
}
