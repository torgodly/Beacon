import {
    Check,
    Copy,
    Maximize2,
    Minimize2,
    Pin,
    PinOff,
    Search,
    TerminalIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Status } from '@/components/status-badge';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * ANSI SGR → Beacon log-level colours (PDF §02).
 *
 * The 8 log levels map onto the standard ANSI foreground codes a deploy
 * script actually emits. There is deliberately no blue in the system, so
 * ANSI 34/94 resolve to cyan rather than introducing a second accent.
 */
const ANSI_FOREGROUND_CLASSES: Record<number, string> = {
    30: 'text-[var(--bc-log-trace)]',
    31: 'text-[var(--bc-log-error)]',
    32: 'text-[var(--bc-log-success)]',
    33: 'text-[var(--bc-log-warn)]',
    34: 'text-[var(--bc-log-notice)]', // no blue in this system
    35: 'text-[var(--bc-violet-400)]',
    36: 'text-[var(--bc-cyan-400)]',
    37: 'text-[var(--bc-log-info)]',
    90: 'text-[var(--bc-log-trace)]',
    91: 'text-[var(--bc-log-fatal)]',
    92: 'text-[var(--bc-green-300)]',
    93: 'text-[var(--bc-amber-300)]',
    94: 'text-[var(--bc-cyan-300)]',
    95: 'text-[var(--bc-violet-300)]',
    96: 'text-[var(--bc-cyan-200)]',
    97: 'text-[var(--bc-slate-0)]',
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function stripNonColorAnsi(input: string): string {
    // eslint-disable-next-line no-control-regex -- strip ANSI cursor/erase sequences
    return input.replace(/\u001b\[[0-9;]*[^0-9;m]/g, '');
}

function ansiToHtml(input: string): string {
    const stripped = stripNonColorAnsi(input);
    // eslint-disable-next-line no-control-regex -- split on ANSI SGR color codes
    const segments = stripped.split(/\u001b\[([0-9;]*)m/);

    let html = '';
    let openSpans = 0;

    segments.forEach((segment, index) => {
        if (index % 2 === 0) {
            html += escapeHtml(segment);

            return;
        }

        const codes = segment
            .split(';')
            .filter(Boolean)
            .map((code) => Number(code));

        for (const code of codes.length ? codes : [0]) {
            if (code === 0) {
                html += '</span>'.repeat(openSpans);
                openSpans = 0;
            } else if (code === 1) {
                html += '<span class="font-semibold">';
                openSpans += 1;
            } else if (ANSI_FOREGROUND_CLASSES[code]) {
                html += `<span class="${ANSI_FOREGROUND_CLASSES[code]}">`;
                openSpans += 1;
            }
        }
    });

    html += '</span>'.repeat(openSpans);

    return html;
}

export type TerminalStatus = Status | 'idle';

export function Terminal({
    chunks,
    status = 'idle',
    title = 'Console',
    autoScroll: autoScrollProp = true,
    emptyMessage = 'Waiting for output…',
    className,
}: {
    chunks: string[];
    status?: TerminalStatus;
    title?: string;
    autoScroll?: boolean;
    emptyMessage?: string;
    className?: string;
}) {
    const scrollRef = useRef<HTMLPreElement>(null);
    const [query, setQuery] = useState('');
    const [autoScroll, setAutoScroll] = useState(autoScrollProp);
    const [fullscreen, setFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const content = chunks.join('');

    const filteredContent = useMemo(() => {
        if (!query.trim()) {
            return content;
        }

        const needle = query.toLowerCase();

        return content
            .split('\n')
            .filter((line) => line.toLowerCase().includes(needle))
            .join('\n');
    }, [content, query]);

    useEffect(() => {
        if (!autoScroll) {
            return;
        }

        const node = scrollRef.current;

        if (node) {
            node.scrollTop = node.scrollHeight;
        }
    }, [filteredContent, autoScroll]);

    async function copyLogs() {
        if (!content) {
            return;
        }

        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    }

    return (
        <div
            className={cn(
                // bg/terminal is slate-1000 in BOTH themes. A light-theme log
                // viewer breaks recognition of the level colours.
                'overflow-hidden rounded-lg border border-[var(--bc-slate-800)] bg-terminal text-[var(--bc-log-info)]',
                fullscreen &&
                    'fixed inset-4 z-50 flex flex-col shadow-[var(--bc-shadow-xl)]',
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bc-slate-800)] bg-[var(--bc-slate-950)] px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <TerminalIcon
                        aria-hidden="true"
                        strokeWidth={1.5}
                        className="size-4 shrink-0 text-[var(--bc-slate-500)]"
                    />
                    <span className="truncate font-mono text-[12px] leading-[18px] font-medium text-[var(--bc-slate-400)]">
                        {title}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-[var(--bc-slate-500)]" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter logs…"
                            className="h-7 w-40 border-[var(--bc-slate-700)] bg-terminal pl-7 font-mono text-[12px] text-[var(--bc-log-info)] placeholder:text-[var(--bc-slate-500)]"
                        />
                    </div>

                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[var(--bc-slate-300)] hover:bg-[var(--bc-slate-800)] hover:text-[var(--bc-slate-0)]"
                        onClick={() => void copyLogs()}
                        disabled={!content}
                    >
                        {copied ? (
                            <Check className="size-3.5 text-[var(--bc-log-success)]" />
                        ) : (
                            <Copy className="size-3.5" />
                        )}
                        <span className="sr-only">Copy logs</span>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(
                            'h-7 px-2 text-[var(--bc-slate-300)] hover:bg-[var(--bc-slate-800)] hover:text-[var(--bc-slate-0)]',
                            autoScroll && 'text-[var(--bc-log-success)]',
                        )}
                        onClick={() => setAutoScroll((previous) => !previous)}
                    >
                        {autoScroll ? (
                            <Pin className="size-3.5" />
                        ) : (
                            <PinOff className="size-3.5" />
                        )}
                        <span className="sr-only">Toggle auto-scroll</span>
                    </Button>

                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[var(--bc-slate-300)] hover:bg-[var(--bc-slate-800)] hover:text-[var(--bc-slate-0)]"
                        onClick={() => setFullscreen((previous) => !previous)}
                    >
                        {fullscreen ? (
                            <Minimize2 className="size-3.5" />
                        ) : (
                            <Maximize2 className="size-3.5" />
                        )}
                        <span className="sr-only">Toggle fullscreen</span>
                    </Button>

                    {status !== 'idle' && <StatusBadge status={status} />}
                </div>
            </div>

            <pre
                ref={scrollRef}
                className={cn(
                    'overflow-auto p-4 font-mono text-[13px] leading-5 whitespace-pre-wrap tabular-nums',
                    fullscreen ? 'max-h-none flex-1' : 'max-h-96',
                )}
            >
                {filteredContent ? (
                    <code
                        dangerouslySetInnerHTML={{
                            __html: ansiToHtml(filteredContent),
                        }}
                    />
                ) : (
                    <span className="text-[var(--bc-slate-500)]">
                        {query ? 'No matching log lines.' : emptyMessage}
                    </span>
                )}
            </pre>
        </div>
    );
}
