import { Minus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Terminal } from '@/components/terminal';
import { Button } from '@/components/ui/button';
import { useOperationLog } from '@/hooks/use-operations';

function formatDuration(ms: number | null): string {
    if (ms === null) {
        return '—';
    }

    if (ms < 1000) {
        return `${ms}ms`;
    }

    const seconds = Math.round(ms / 1000);

    return seconds < 60
        ? `${seconds}s`
        : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/**
 * The operation console overlay.
 *
 * Minimising returns it to the dock without interrupting the stream, and
 * reopening replays from byte zero — so closing this is never destructive.
 * That is the contract that makes it safe to dismiss a ten-minute apt run.
 */
export function OperationConsole({
    uuid,
    onClose,
}: {
    uuid: string;
    onClose: () => void;
}) {
    const { chunks, operation } = useOperationLog(uuid);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    // Focus moves in on open and returns to the trigger on close; Esc closes.
    useEffect(() => {
        previouslyFocused.current = document.activeElement as HTMLElement | null;
        dialogRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused.current?.focus();
        };
    }, [onClose]);

    const status = operation?.status ?? 'queued';
    const running = status === 'running' || status === 'queued';

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
            <div
                className="absolute inset-0 bg-[var(--bc-bg-overlay)]"
                onClick={onClose}
                aria-hidden="true"
            />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={operation?.title ?? 'Operation console'}
                tabIndex={-1}
                className="bc-elevation-3 relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl outline-none"
            >
                <header className="flex items-center gap-3 border-b border-[var(--bc-border-default)] px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                        <p className="text-overline text-fg-subtle">
                            {(operation?.type ?? '').replace('.', ' // ') ||
                                'operation'}
                        </p>
                        <h2 className="truncate text-[16px] leading-6 font-semibold text-fg-strong">
                            {operation?.title ?? 'Operation'}
                        </h2>
                    </div>

                    <dl className="hidden items-center gap-5 sm:flex">
                        <div className="text-right">
                            <dt className="text-overline text-fg-subtle">
                                Elapsed
                            </dt>
                            <dd className="font-mono text-[13px] tabular-nums text-fg">
                                {formatDuration(operation?.duration_ms ?? null)}
                            </dd>
                        </div>
                        {operation?.exit_code !== null &&
                            operation?.exit_code !== undefined && (
                                <div className="text-right">
                                    <dt className="text-overline text-fg-subtle">
                                        Exit
                                    </dt>
                                    <dd className="font-mono text-[13px] tabular-nums text-fg">
                                        {operation.exit_code}
                                    </dd>
                                </div>
                            )}
                    </dl>

                    <StatusPill status={toStatus(status)} />

                    <div className="flex items-center gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Minimise to dock"
                            title="Minimise to dock"
                        >
                            <Minus className="size-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={onClose}
                            aria-label="Close console"
                            title="Close"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-hidden p-4">
                    <Terminal
                        chunks={chunks}
                        title={operation?.summary ?? operation?.type ?? 'output'}
                        className="h-full [&>pre]:max-h-[55vh]"
                        emptyMessage={
                            running
                                ? 'Waiting for output…'
                                : 'This operation produced no output.'
                        }
                    />
                </div>

                {operation?.error && (
                    <p
                        role="alert"
                        className="border-t border-[var(--bc-border-danger)] bg-danger-subtle px-5 py-3 text-[13px] leading-5 text-fg-danger"
                    >
                        {operation.error}
                    </p>
                )}

                <footer className="flex items-center justify-between border-t border-[var(--bc-border-default)] px-5 py-3">
                    <p className="text-[13px] leading-5 text-fg-muted">
                        {running
                            ? 'Still running. Closing this keeps it in the dock.'
                            : 'Finished. Reopen from the dock at any time.'}
                    </p>
                    <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                        Close
                    </Button>
                </footer>
            </div>
        </div>
    );
}
