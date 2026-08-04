import { useCallback } from 'react';
import { Terminal } from '@/components/terminal';
import type { TerminalStatus } from '@/components/terminal';
import {
    isActiveStreamStatus,
    useLiveLogStream,
} from '@/hooks/use-live-log-stream';
import { log as commandLog } from '@/routes/sites/commands';

export type CommandStreamPayload = {
    uuid: string;
    command: string;
    status: string;
};

function commandTerminalStatus(status: string): TerminalStatus {
    if (isActiveStreamStatus(status)) {
        return 'running';
    }

    if (status === 'success') {
        return 'success';
    }

    if (status === 'failed' || status === 'timed_out') {
        return 'failed';
    }

    return 'idle';
}

export function CommandLogViewer({
    siteId,
    command,
}: {
    siteId: string;
    command: CommandStreamPayload;
}) {
    const fetchLog = useCallback(
        async (offset: number) => {
            const response = await fetch(
                commandLog.url(
                    { site: siteId, command: command.uuid },
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
        [siteId, command.uuid],
    );

    const { chunks, status } = useLiveLogStream({
        streamKey: command.uuid,
        initialStatus: command.status,
        fetchLog,
        reloadOnly: ['consoleCommands', 'activeCommand'],
    });

    return (
        <Terminal
            title={command.command}
            status={commandTerminalStatus(status)}
            chunks={chunks}
            emptyMessage={
                status === 'queued'
                    ? 'Waiting for the command worker…'
                    : 'Waiting for output…'
            }
        />
    );
}
