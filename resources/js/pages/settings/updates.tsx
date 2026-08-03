import { Form, Head, router, usePage } from '@inertiajs/react';
import { ArrowDownCircle, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Terminal } from '@/components/terminal';
import type { TerminalStatus } from '@/components/terminal';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    edit as updatesEdit,
    log as updateLog,
    rollback,
    store,
} from '@/routes/updates';

type UpdateRow = {
    uuid: string;
    action: string;
    tag: string | null;
    status: string;
    exit_code: number | null;
    error: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string | null;
};

type ActiveUpdate = UpdateRow;

function updateTerminalStatus(status: string): TerminalStatus {
    return ({
        queued: 'pending',
        running: 'running',
        success: 'success',
        failed: 'failed',
    }[status] ?? 'idle') as TerminalStatus;
}

function updateBadgeStatus(status: string): Status {
    return ({
        queued: 'pending',
        running: 'running',
        success: 'success',
        failed: 'failed',
    }[status] ?? 'info') as Status;
}

function UpdateLogViewer({ update }: { update: ActiveUpdate }) {
    return <UpdateLogViewerContent key={update.uuid} update={update} />;
}

function UpdateLogViewerContent({ update }: { update: ActiveUpdate }) {
    const [chunks, setChunks] = useState<string[]>([]);
    const [status, setStatus] = useState(update.status);
    const offsetRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        async function poll() {
            const response = await fetch(
                updateLog.url(
                    { update: update.uuid },
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
            };

            if (data.chunk) {
                setChunks((previous) => [...previous, data.chunk]);
            }

            offsetRef.current = data.offset;
            setStatus(data.status);
        }

        void poll();

        const interval = setInterval(() => {
            if (status === 'queued' || status === 'running') {
                void poll();
            }
        }, 1000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [update.uuid, status]);

    return (
        <Terminal
            chunks={chunks}
            status={updateTerminalStatus(status)}
            title={`Panel ${update.action}`}
        />
    );
}

export default function UpdatesSettings({
    currentVersion,
    repo,
    history,
    activeUpdate,
}: {
    currentVersion: string;
    repo: string;
    history: UpdateRow[];
    activeUpdate: ActiveUpdate | null;
}) {
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };

    return (
        <>
            <Head title="Panel updates" />

            <h1 className="sr-only">Panel updates</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Panel updates"
                    description="Deploy tagged releases to this server and roll back if health checks fail."
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Current release
                        </CardTitle>
                        <CardDescription>
                            Repository:{' '}
                            <span className="font-mono">{repo}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <StatusBadge
                                status="success"
                                label={currentVersion}
                            />
                            <span className="text-sm text-muted-foreground">
                                Active panel version
                            </span>
                        </div>

                        <Form {...store.form()} className="grid max-w-sm gap-3">
                            {({ errors, processing }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="tag">Release tag</Label>
                                        <Input
                                            id="tag"
                                            name="tag"
                                            placeholder="v1.0.0"
                                            autoComplete="off"
                                        />
                                        <InputError message={errors.tag} />
                                    </div>
                                    <Button type="submit" disabled={processing}>
                                        <RefreshCw className="size-4" />
                                        Deploy update
                                    </Button>
                                </>
                            )}
                        </Form>

                        <ConfirmDialog
                            trigger={
                                <Button variant="outline">
                                    <ArrowDownCircle className="size-4" />
                                    Roll back
                                </Button>
                            }
                            title="Roll back panel?"
                            description="Promotes the previous release symlink and restarts PHP-FPM and the panel worker."
                            confirmLabel="Roll back"
                            destructive
                            onConfirm={() => router.post(rollback.url())}
                        />
                        <InputError message={errors.update} />
                    </CardContent>
                </Card>

                {activeUpdate && <UpdateLogViewer update={activeUpdate} />}

                {history.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Recent updates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {history.map((update) => (
                                <div
                                    key={update.uuid}
                                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                                >
                                    <div>
                                        <p className="font-medium capitalize">
                                            {update.action}
                                            {update.tag ? ` ${update.tag}` : ''}
                                        </p>
                                        {update.error && (
                                            <p className="text-xs text-destructive">
                                                {update.error}
                                            </p>
                                        )}
                                    </div>
                                    <StatusBadge
                                        status={updateBadgeStatus(
                                            update.status,
                                        )}
                                        label={update.status}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

UpdatesSettings.layout = {
    breadcrumbs: [{ title: 'Panel updates', href: updatesEdit() }],
};
