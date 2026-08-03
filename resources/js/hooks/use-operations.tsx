import { router } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

export type OperationStatus = 'queued' | 'running' | 'success' | 'failed';

export type Operation = {
    uuid: string;
    type: string;
    title: string;
    summary: string | null;
    status: OperationStatus;
    exit_code: number | null;
    error: string | null;
    started_at: string | null;
    finished_at: string | null;
    duration_ms: number | null;
    created_at: string | null;
};

type OperationsContextValue = {
    operations: Operation[];
    activeCount: number;
    /** uuid of the operation whose console is open, or null. */
    openUuid: string | null;
    open: (uuid: string) => void;
    close: () => void;
    /** Dock is collapsed to a single summary chip. */
    collapsed: boolean;
    setCollapsed: (value: boolean) => void;
    refresh: () => void;
    dismiss: (uuid: string) => void;
    dismissed: string[];
};

const OperationsContext = createContext<OperationsContextValue | null>(null);

const ACTIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 20000;

/**
 * Tracks every long-running action in the panel.
 *
 * This lives above the Inertia page tree (mounted in `withApp`), so an
 * operation started on the PHP page keeps streaming while the operator
 * navigates to Sites — which is the entire point. Closing the console only
 * hides it; the operation is still there in the dock, and reopening it
 * replays the full log from byte zero.
 */
export function OperationsProvider({ children }: PropsWithChildren) {
    const [operations, setOperations] = useState<Operation[]>([]);
    const [openUuid, setOpenUuid] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [dismissed, setDismissed] = useState<string[]>([]);
    const timerRef = useRef<number | null>(null);
    const inFlight = useRef(false);

    const activeCount = useMemo(
        () =>
            operations.filter(
                (operation) =>
                    operation.status === 'running' ||
                    operation.status === 'queued',
            ).length,
        [operations],
    );

    const refresh = useCallback(async () => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;

        try {
            const response = await fetch('/api/operations', {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                return;
            }

            const data = (await response.json()) as {
                operations: Operation[];
            };

            setOperations(data.operations ?? []);
        } catch {
            // A failed poll is not worth surfacing — the next tick retries.
        } finally {
            inFlight.current = false;
        }
    }, []);

    // Poll fast while work is in flight, slowly when idle. An operator
    // watching apt install PHP wants sub-second feedback; an idle panel
    // should not hammer its own server.
    useEffect(() => {
        const interval = activeCount > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;

        // Deferred so the first poll never resolves synchronously inside the
        // effect body, which would trigger a cascading render.
        const kickoff = window.setTimeout(() => void refresh(), 0);
        timerRef.current = window.setInterval(() => void refresh(), interval);

        return () => {
            window.clearTimeout(kickoff);

            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
            }
        };
    }, [activeCount, refresh]);

    // Any Inertia request may have just kicked off an operation, so re-poll
    // immediately rather than waiting up to 20s for the idle tick.
    useEffect(() => {
        return router.on('finish', () => {
            void refresh();
        });
    }, [refresh]);

    const open = useCallback((uuid: string) => {
        setOpenUuid(uuid);
        setCollapsed(false);
    }, []);

    const close = useCallback(() => setOpenUuid(null), []);

    const dismiss = useCallback(
        (uuid: string) => {
            setDismissed((current) => [...current, uuid]);

            if (openUuid === uuid) {
                setOpenUuid(null);
            }
        },
        [openUuid],
    );

    const value = useMemo<OperationsContextValue>(
        () => ({
            operations: operations.filter(
                (operation) => !dismissed.includes(operation.uuid),
            ),
            activeCount,
            openUuid,
            open,
            close,
            collapsed,
            setCollapsed,
            refresh: () => void refresh(),
            dismiss,
            dismissed,
        }),
        [
            operations,
            activeCount,
            openUuid,
            open,
            close,
            collapsed,
            refresh,
            dismiss,
            dismissed,
        ],
    );

    return (
        <OperationsContext.Provider value={value}>
            {children}
        </OperationsContext.Provider>
    );
}

export function useOperations(): OperationsContextValue {
    const context = useContext(OperationsContext);

    if (context === null) {
        throw new Error('useOperations must be used within an OperationsProvider');
    }

    return context;
}

/**
 * Streams one operation's log by byte offset.
 *
 * Returns the whole log from offset 0 on mount, so reopening a console that
 * was closed ten minutes ago shows the complete history, not just the tail.
 */
export function useOperationLog(uuid: string | null) {
    const [chunks, setChunks] = useState<string[]>([]);
    const [operation, setOperation] = useState<Operation | null>(null);
    const offsetRef = useRef(0);
    const activeUuid = useRef<string | null>(null);

    useEffect(() => {
        if (uuid === null) {
            return;
        }

        // Switching operations resets the buffer and the offset.
        if (activeUuid.current !== uuid) {
            activeUuid.current = uuid;
            offsetRef.current = 0;
            setChunks([]);
            setOperation(null);
        }

        let cancelled = false;
        let timer: number | null = null;

        async function tick() {
            try {
                const response = await fetch(
                    `/api/operations/${uuid}/log?offset=${offsetRef.current}`,
                    {
                        headers: { Accept: 'application/json' },
                        credentials: 'same-origin',
                    },
                );

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    operation: Operation;
                    offset: number;
                    chunk: string;
                };

                offsetRef.current = data.offset;
                setOperation(data.operation);

                if (data.chunk) {
                    setChunks((current) => [...current, data.chunk]);
                }

                const stillRunning =
                    data.operation.status === 'running' ||
                    data.operation.status === 'queued';

                if (stillRunning && !cancelled) {
                    timer = window.setTimeout(() => void tick(), 1000);
                }
            } catch {
                if (!cancelled) {
                    timer = window.setTimeout(() => void tick(), 3000);
                }
            }
        }

        void tick();

        return () => {
            cancelled = true;

            if (timer !== null) {
                window.clearTimeout(timer);
            }
        };
    }, [uuid]);

    return { chunks, operation };
}
