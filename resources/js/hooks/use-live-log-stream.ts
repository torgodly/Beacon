import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export function isActiveStreamStatus(status: string): boolean {
    return status === 'queued' || status === 'running';
}

export function isTerminalStreamStatus(status: string): boolean {
    return (
        status === 'success' ||
        status === 'failed' ||
        status === 'cancelled' ||
        status === 'timed_out'
    );
}

export type LiveLogPollResponse = {
    offset: number;
    chunk: string;
    status: string;
    duration_ms?: number | null;
};

export function useLiveLogStream({
    streamKey,
    initialStatus,
    fetchLog,
    reloadOnly,
    pollIntervalMs = 1000,
}: {
    /** Changing this resets the stream buffer. */
    streamKey: string;
    initialStatus: string;
    fetchLog: (offset: number) => Promise<LiveLogPollResponse | null>;
    /** Inertia props to reload once when the stream finishes. */
    reloadOnly?: string[];
    pollIntervalMs?: number;
}) {
    const [chunks, setChunks] = useState<string[]>([]);
    const [status, setStatus] = useState(initialStatus);
    const [durationMs, setDurationMs] = useState<number | null>(null);
    const offsetRef = useRef(0);
    const reloadedRef = useRef(false);
    const fetchLogRef = useRef(fetchLog);
    const reloadOnlyRef = useRef(reloadOnly);

    fetchLogRef.current = fetchLog;
    reloadOnlyRef.current = reloadOnly;

    useEffect(() => {
        offsetRef.current = 0;
        reloadedRef.current = false;
        setChunks([]);
        setStatus(initialStatus);
        setDurationMs(null);

        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            let data: LiveLogPollResponse | null;

            try {
                data = await fetchLogRef.current(offsetRef.current);
            } catch {
                if (!cancelled) {
                    timer = window.setTimeout(() => void tick(), 3000);
                }

                return;
            }

            if (!data || cancelled) {
                return;
            }

            if (data.chunk) {
                setChunks((previous) => [...previous, data.chunk]);
            }

            offsetRef.current = data.offset;
            setStatus(data.status);

            if (data.duration_ms !== undefined) {
                setDurationMs(data.duration_ms);
            }

            if (isTerminalStreamStatus(data.status) && !reloadedRef.current) {
                reloadedRef.current = true;

                const keys = reloadOnlyRef.current;

                if (keys && keys.length > 0) {
                    router.reload({ only: keys });
                }
            }

            if (isActiveStreamStatus(data.status) && !cancelled) {
                timer = window.setTimeout(() => void tick(), pollIntervalMs);
            }
        }

        void tick();

        return () => {
            cancelled = true;

            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [streamKey, initialStatus, pollIntervalMs]);

    return { chunks, status, durationMs };
}
