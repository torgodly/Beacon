import { router } from '@inertiajs/react';
import { useEffect } from 'react';
import type { SiteSummary } from '@/layouts/site/layout';

const ACTIVE_DEPLOYMENT_STATUSES = new Set(['queued', 'running']);

export function useSiteLiveUpdates(
    site: SiteSummary | undefined,
    tab: string,
): void {
    useEffect(() => {
        if (!site?.id) {
            return;
        }

        const deploymentStatus = site.deployment_status ?? 'idle';
        const busy = ACTIVE_DEPLOYMENT_STATUSES.has(deploymentStatus);
        const watchesRepository = Boolean(site.auto_deploy);

        if (!busy && !watchesRepository) {
            return;
        }

        const intervalSeconds =
            typeof site.effective_poll_interval_seconds === 'number'
                ? site.effective_poll_interval_seconds
                : 60;

        const intervalMs = busy
            ? 3000
            : Math.min(intervalSeconds * 1000, 15000);

        const only = ['site', 'activeDeployment', 'latestDeployment'];

        if (tab === 'overview' || tab === 'deployments') {
            only.push('deployments');
        }

        const timer = window.setInterval(() => {
            router.reload({
                only,
                preserveScroll: true,
                preserveState: true,
            });
        }, intervalMs);

        return () => window.clearInterval(timer);
    }, [
        site?.id,
        site?.auto_deploy,
        site?.deployment_status,
        site?.effective_poll_interval_seconds,
        tab,
    ]);
}
