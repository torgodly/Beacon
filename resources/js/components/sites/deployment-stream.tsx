import { useCallback } from 'react';
import { Panel } from '@/components/console/panel';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Terminal } from '@/components/terminal';
import type { TerminalStatus } from '@/components/terminal';
import {
    isActiveStreamStatus,
    useLiveLogStream,
} from '@/hooks/use-live-log-stream';
import { log as deploymentLog } from '@/routes/sites/deployments';

export type DeploymentStreamPayload = {
    uuid: string;
    status: string;
    trigger?: string;
    branch?: string | null;
    commit_sha?: string | null;
    commit_message?: string | null;
    duration_ms?: number | null;
    created_at?: string | null;
};

function deploymentTerminalStatus(status: string): TerminalStatus {
    if (isActiveStreamStatus(status)) {
        return 'running';
    }

    if (status === 'success') {
        return 'success';
    }

    if (status === 'failed') {
        return 'failed';
    }

    return 'idle';
}

function formatDuration(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) {
        return '—';
    }

    if (ms < 1000) {
        return `${ms}ms`;
    }

    return `${(ms / 1000).toFixed(1)}s`;
}

export function DeploymentStream({
    siteId,
    deployment,
    compact = false,
}: {
    siteId: string;
    deployment: DeploymentStreamPayload;
    compact?: boolean;
}) {
    const fetchLog = useCallback(
        async (offset: number) => {
            const response = await fetch(
                deploymentLog.url(
                    { site: siteId, deployment: deployment.uuid },
                    { query: { offset } },
                ),
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                return null;
            }

            return (await response.json()) as {
                offset: number;
                chunk: string;
                status: string;
                duration_ms: number | null;
            };
        },
        [siteId, deployment.uuid],
    );

    const { chunks, status, durationMs } = useLiveLogStream({
        streamKey: deployment.uuid,
        initialStatus: deployment.status,
        fetchLog,
        reloadOnly: [
            'site',
            'deployments',
            'activeDeployment',
            'latestDeployment',
        ],
    });

    const title = compact
        ? `Deploy ${deployment.uuid.slice(0, 8)}`
        : 'Live deployment output';

    const meta = [
        deployment.trigger && `trigger · ${deployment.trigger}`,
        deployment.branch && `branch · ${deployment.branch}`,
        deployment.commit_sha && deployment.commit_sha.slice(0, 7),
        formatDuration(durationMs ?? deployment.duration_ms),
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <Panel
            eyebrow="deploy // stream"
            title={title}
            description={
                meta ||
                'Output from git sync and the deploy script appears here in real time.'
            }
            actions={
                <StatusPill
                    status={toStatus(status)}
                    label={status}
                    size="sm"
                />
            }
            flush
        >
            <Terminal
                chunks={chunks}
                status={deploymentTerminalStatus(status)}
                title={deployment.commit_message ?? deployment.uuid.slice(0, 8)}
                emptyMessage={
                    status === 'queued'
                        ? 'Waiting for the deployment worker…'
                        : 'Fetching build output…'
                }
            />
        </Panel>
    );
}
