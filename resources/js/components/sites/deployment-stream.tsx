import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/console/panel';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Terminal } from '@/components/terminal';
import type { TerminalStatus } from '@/components/terminal';
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
    if (status === 'running' || status === 'queued') {
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
    const [chunks, setChunks] = useState<string[]>([]);
    const [status, setStatus] = useState(deployment.status);
    const [durationMs, setDurationMs] = useState(
        deployment.duration_ms ?? null,
    );
    const offsetRef = useRef(0);

    useEffect(() => {
        let cancelled = false;
        let currentStatus = deployment.status;

        async function poll() {
            const response = await fetch(
                deploymentLog.url(
                    { site: siteId, deployment: deployment.uuid },
                    { query: { offset: offsetRef.current } },
                ),
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok || cancelled) {
                return;
            }

            const data = (await response.json()) as {
                offset: number;
                chunk: string;
                status: string;
                duration_ms: number | null;
            };

            if (data.chunk) {
                setChunks((previous) => [...previous, data.chunk]);
            }

            offsetRef.current = data.offset;
            currentStatus = data.status;
            setStatus(data.status);
            setDurationMs(data.duration_ms);
        }

        void poll();

        const interval = window.setInterval(() => {
            if (currentStatus === 'queued' || currentStatus === 'running') {
                void poll();
            }
        }, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [deployment.uuid, siteId, deployment.status, deployment.duration_ms]);

    const title = compact
        ? `Deploy ${deployment.uuid.slice(0, 8)}`
        : 'Live deployment output';

    const meta = [
        deployment.trigger && `trigger · ${deployment.trigger}`,
        deployment.branch && `branch · ${deployment.branch}`,
        deployment.commit_sha && deployment.commit_sha.slice(0, 7),
        formatDuration(durationMs),
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
