import { ChevronDown, ChevronUp, Terminal as TerminalIcon, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import type { Operation } from '@/hooks/use-operations';
import { useOperations } from '@/hooks/use-operations';
import { cn } from '@/lib/utils';
import { OperationConsole } from './operation-console';

function elapsed(operation: Operation, now: number): string {
    if (operation.duration_ms !== null) {
        return formatMs(operation.duration_ms);
    }

    if (operation.started_at === null) {
        return '—';
    }

    return formatMs(now - new Date(operation.started_at).getTime());
}

function formatMs(ms: number): string {
    if (ms < 1000) {
        return `${Math.max(0, ms)}ms`;
    }

    const seconds = Math.floor(ms / 1000);

    if (seconds < 60) {
        return `${seconds}s`;
    }

    return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

/**
 * The persistent operations dock.
 *
 * Anchored bottom-inline-end, above everything, outside the Inertia page tree.
 * Every privileged action lands here the moment it starts, so the operator
 * always has somewhere to look — the fix for "install PHP" showing nothing
 * but the word "installing" for two minutes.
 */
export function OperationDock() {
    const { operations, activeCount, openUuid, open, close, collapsed, setCollapsed, dismiss } =
        useOperations();
    const [now, setNow] = useState(() => Date.now());

    // Only tick the elapsed clock while something is actually running.
    useEffect(() => {
        if (activeCount === 0) {
            return;
        }

        const timer = window.setInterval(() => setNow(Date.now()), 1000);

        return () => window.clearInterval(timer);
    }, [activeCount]);

    if (operations.length === 0) {
        return null;
    }

    const visible = collapsed ? [] : operations.slice(0, 4);

    return (
        <>
            <div
                className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(23rem,calc(100vw-2rem))] flex-col items-end gap-2"
                role="region"
                aria-label="Background operations"
            >
                {visible.map((operation) => (
                    <button
                        key={operation.uuid}
                        type="button"
                        onClick={() => open(operation.uuid)}
                        className={cn(
                            'pointer-events-auto group w-full rounded-lg border text-left',
                            'bc-elevation-2 transition-colors duration-[--bc-duration-fast]',
                            'hover:border-border-hover',
                            openUuid === operation.uuid && 'border-border-brand',
                        )}
                    >
                        <div className="flex items-center gap-3 px-3 py-2.5">
                            <TerminalIcon
                                aria-hidden="true"
                                strokeWidth={1.5}
                                className="size-4 shrink-0 text-fg-subtle"
                            />

                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] leading-5 font-medium text-fg">
                                    {operation.title}
                                </span>
                                <span className="text-overline block text-fg-subtle">
                                    {operation.type.replace('.', ' // ')}
                                </span>
                            </span>

                            <span className="shrink-0 font-mono text-[12px] tabular-nums text-fg-subtle">
                                {elapsed(operation, now)}
                            </span>

                            <StatusPill
                                status={toStatus(operation.status)}
                                size="sm"
                            />

                            <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Dismiss ${operation.title}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    dismiss(operation.uuid);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        dismiss(operation.uuid);
                                    }
                                }}
                                className="shrink-0 rounded-sm p-0.5 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-fg"
                            >
                                <X className="size-3.5" />
                            </span>
                        </div>
                    </button>
                ))}

                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setCollapsed(!collapsed)}
                    className="pointer-events-auto bc-elevation-2"
                >
                    {collapsed ? (
                        <ChevronUp className="size-3.5" />
                    ) : (
                        <ChevronDown className="size-3.5" />
                    )}
                    <span className="font-mono text-[12px] tracking-[0.06em] uppercase">
                        {activeCount > 0
                            ? `${activeCount} running`
                            : `${operations.length} recent`}
                    </span>
                </Button>
            </div>

            {openUuid !== null && (
                <OperationConsole uuid={openUuid} onClose={close} />
            )}
        </>
    );
}
