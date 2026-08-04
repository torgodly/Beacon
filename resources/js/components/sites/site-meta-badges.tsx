import {
    ForgeEnvBadge,
    ForgeFrameworkBadge,
    ForgeRuntimeBadge,
} from '@/components/forge/forge-badge';
import type { AppEnv } from '@/lib/site-env';

type SiteMeta = {
    type?: string;
    php_version?: string | null;
    app_env?: AppEnv | null;
};

export function SiteMetaBadges({
    site,
    className,
}: {
    site: SiteMeta;
    className?: string;
}) {
    return (
        <div className={className ?? 'flex flex-wrap items-center gap-2'}>
            {site.type ? <ForgeFrameworkBadge type={site.type} /> : null}
            {site.php_version ? (
                <ForgeRuntimeBadge label={`PHP ${site.php_version}`} />
            ) : null}
            {site.type === 'laravel' && site.app_env ? (
                <ForgeEnvBadge env={site.app_env} />
            ) : null}
        </div>
    );
}
