import {
    Check,
    Copy,
    Maximize2,
    Minimize2,
    Pin,
    PinOff,
    Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Status } from '@/components/status-badge';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const ANSI_FOREGROUND_CLASSES: Record<number, string> = {
    30: 'text-neutral-500',
    31: 'text-red-400',
    32: 'text-green-400',
    33: 'text-yellow-400',
    34: 'text-blue-400',
    35: 'text-purple-400',
    36: 'text-cyan-400',
    37: 'text-neutral-200',
    90: 'text-neutral-600',
    91: 'text-red-300',
    92: 'text-green-300',
    93: 'text-yellow-300',
    94: 'text-blue-300',
    95: 'text-purple-300',
    96: 'text-cyan-300',
    97: 'text-white',
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
                'overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-100',
                fullscreen && 'fixed inset-4 z-50 flex flex-col shadow-2xl',
                className,
            )}
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex gap-1.5">
                        <span className="size-2.5 rounded-full bg-red-500/70" />
                        <span className="size-2.5 rounded-full bg-yellow-500/70" />
                        <span className="size-2.5 rounded-full bg-green-500/70" />
                    </span>
                    <span className="truncate text-xs font-medium text-neutral-400">
                        {title}
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-neutral-500" />
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter logs…"
                            className="h-7 w-36 border-neutral-700 bg-neutral-950 pl-7 text-xs text-neutral-100 placeholder:text-neutral-500"
                        />
                    </div>

                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                        onClick={() => void copyLogs()}
                        disabled={!content}
                    >
                        {copied ? (
                            <Check className="size-3.5 text-emerald-400" />
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
                            'h-7 px-2 text-neutral-300 hover:bg-neutral-800 hover:text-white',
                            autoScroll && 'text-emerald-300',
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
                        className="h-7 px-2 text-neutral-300 hover:bg-neutral-800 hover:text-white"
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
                    'overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap',
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
                    <span className="text-neutral-500">
                        {query ? 'No matching log lines.' : emptyMessage}
                    </span>
                )}
            </pre>
        </div>
    );
}
