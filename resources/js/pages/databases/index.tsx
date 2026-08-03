import { Form, Head, router, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    Database,
    Download,
    HardDriveDownload,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState, PageHeader } from '@/components/console/page-header';
import { Panel, StatCluster } from '@/components/console/panel';
import InputError from '@/components/input-error';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import {
    DataTable,
    TableBody,
    TableCell,
    TableHead,
    TableHeaderCell,
    TableRow,
} from '@/components/ui/data-table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { store as storeDatabaseUser } from '@/routes/database-users';
import {
    destroy as destroyDatabase,
    index as databasesIndex,
    store as storeDatabase,
} from '@/routes/databases';
import { store as storeBackup } from '@/routes/databases/backups';

type DatabaseUserRow = { id: number; username: string; privileges: string };

type DatabaseBackupRow = {
    uuid: string;
    filename: string;
    status: string;
    size_bytes: number | null;
    error: string | null;
    finished_at: string | null;
    download_url: string | null;
};

type ConnectionRow = {
    user_id: number;
    username: string;
    host: string;
    laravel: string;
    url: string;
};

type DatabaseRow = {
    id: number;
    name: string;
    status: string;
    users: DatabaseUserRow[];
    backups: DatabaseBackupRow[];
    connections: ConnectionRow[];
};

function bytes(size: number | null): string {
    if (size === null) {
        return '—';
    }

    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Copy-to-clipboard for connection strings — the whole point of the card. */
function CopyRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <span className="text-overline w-16 shrink-0 font-mono text-fg-subtle">
                {label}
            </span>
            <code className="min-w-0 flex-1 truncate rounded-sm bg-[var(--bc-bg-surface-sunken)] px-2 py-1 font-mono text-[12px] leading-[18px] text-fg-code">
                {value}
            </code>
            <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Copy ${label}`}
                onClick={() => {
                    void navigator.clipboard.writeText(value);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                }}
            >
                {copied ? (
                    <Check className="size-3.5 text-fg-success" />
                ) : (
                    <Copy className="size-3.5" />
                )}
            </Button>
        </div>
    );
}

export default function DatabasesIndex({
    databases,
}: {
    databases: DatabaseRow[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [selectedDatabase, setSelectedDatabase] = useState<string>('');

    const page = usePage<{
        flash?: { database_user_password?: string | null };
    }>();
    const revealedPassword = page.props.flash?.database_user_password ?? null;

    const totalUsers = databases.reduce(
        (total, database) => total + database.users.length,
        0,
    );

    return (
        <>
            <Head title="Databases" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="databases"
                    title="Databases"
                    description="MySQL databases, users and manual backups. Beacon connects over the unix socket with a least-privilege admin account."
                    actions={
                        <div className="flex items-center gap-3">
                            <Dialog open={userOpen} onOpenChange={setUserOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="secondary"
                                        disabled={databases.length === 0}
                                    >
                                        <Users />
                                        New user
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Create a database user
                                        </DialogTitle>
                                        <DialogDescription>
                                            The password is generated by Beacon
                                            and shown once, immediately after
                                            creation.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <Form
                                        action={storeDatabaseUser()}
                                        onSuccess={() => setUserOpen(false)}
                                        className="space-y-4"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <Field
                                                    htmlFor="username"
                                                    label="Username"
                                                    required
                                                    error={errors.username}
                                                >
                                                    <Input
                                                        id="username"
                                                        name="username"
                                                        mono
                                                        autoComplete="off"
                                                        placeholder="app_user"
                                                    />
                                                </Field>

                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        htmlFor="database_id"
                                                        className="text-[14px] leading-5 font-medium text-fg"
                                                    >
                                                        Database
                                                    </label>
                                                    <Select
                                                        name="database_id"
                                                        value={selectedDatabase}
                                                        onValueChange={
                                                            setSelectedDatabase
                                                        }
                                                    >
                                                        <SelectTrigger id="database_id">
                                                            <SelectValue placeholder="Grant access to…" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {databases.map(
                                                                (database) => (
                                                                    <SelectItem
                                                                        key={database.id}
                                                                        value={String(
                                                                            database.id,
                                                                        )}
                                                                    >
                                                                        {database.name}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <InputError
                                                        message={errors.database_id}
                                                    />
                                                </div>

                                                <div className="flex justify-end gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setUserOpen(false)
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={processing}
                                                    >
                                                        {processing
                                                            ? 'Creating…'
                                                            : 'Create user'}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </Form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="primary">
                                        <Plus />
                                        New database
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create a database</DialogTitle>
                                        <DialogDescription>
                                            Created as utf8mb4 with a
                                            utf8mb4_unicode_ci collation.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <Form
                                        action={storeDatabase()}
                                        onSuccess={() => setCreateOpen(false)}
                                        className="space-y-4"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <Field
                                                    htmlFor="name"
                                                    label="Name"
                                                    required
                                                    error={errors.name}
                                                    help="Letters, numbers and underscores only."
                                                >
                                                    <Input
                                                        id="name"
                                                        name="name"
                                                        mono
                                                        autoFocus
                                                        autoComplete="off"
                                                        placeholder="app_production"
                                                    />
                                                </Field>

                                                <div className="flex justify-end gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            setCreateOpen(false)
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={processing}
                                                    >
                                                        {processing
                                                            ? 'Creating…'
                                                            : 'Create database'}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </Form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    }
                />

                {revealedPassword && (
                    <div
                        role="alert"
                        className="rounded-lg border border-[var(--bc-border-warning)] bg-warning-subtle px-4 py-3"
                    >
                        <p className="text-overline font-mono text-fg-warning">
                            shown once
                        </p>
                        <p className="mt-1 text-[14px] leading-[22px] text-fg">
                            Copy this password now — Beacon stores it encrypted
                            and will not display it again.
                        </p>
                        <code className="mt-2 block rounded-sm bg-[var(--bc-bg-surface)] px-2 py-1.5 font-mono text-[13px] text-fg-code">
                            {revealedPassword}
                        </code>
                    </div>
                )}

                {databases.length === 0 ? (
                    <EmptyState
                        icon={Database}
                        title="No databases yet"
                        description="Create a MySQL database and Beacon will hand you a ready-to-paste connection string."
                        action={
                            <Button
                                variant="primary"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus />
                                New database
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <StatCluster
                            className="max-w-lg"
                            stats={[
                                { label: 'Databases', value: databases.length },
                                { label: 'Users', value: totalUsers },
                            ]}
                        />

                        <div className="flex flex-col gap-4">
                            {databases.map((database) => (
                                <Panel
                                    key={database.id}
                                    eyebrow="mysql // database"
                                    title={database.name}
                                    icon={Database}
                                    actions={
                                        <>
                                            <StatusPill
                                                status={toStatus(database.status)}
                                                label={database.status}
                                                size="sm"
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    router.post(
                                                        storeBackup.url(database.id),
                                                    )
                                                }
                                            >
                                                <HardDriveDownload className="size-3.5" />
                                                Back up
                                            </Button>
                                            <ConfirmDialog
                                                trigger={
                                                    <Button
                                                        size="icon-sm"
                                                        variant="ghost"
                                                        aria-label={`Drop ${database.name}`}
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                }
                                                title={`Drop ${database.name}?`}
                                                description="Every table and all of its data is destroyed. This cannot be undone."
                                                confirmLabel="Drop database"
                                                destructive
                                                confirmationValue={database.name}
                                                onConfirm={() =>
                                                    router.delete(
                                                        destroyDatabase.url(
                                                            database.id,
                                                        ),
                                                    )
                                                }
                                            />
                                        </>
                                    }
                                >
                                    <div className="grid gap-6 lg:grid-cols-2">
                                        <section className="space-y-3">
                                            <h3 className="text-overline font-mono text-fg-subtle">
                                                connection strings
                                            </h3>

                                            {database.connections.length === 0 ? (
                                                <p className="text-[13px] leading-5 text-fg-muted">
                                                    Create a user to get a
                                                    connection string.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {database.connections.map(
                                                        (connection) => (
                                                            <div
                                                                key={connection.user_id}
                                                                className="space-y-1.5 rounded-md border border-[var(--bc-border-subtle)] p-3"
                                                            >
                                                                <p className="font-mono text-[13px] font-medium text-fg">
                                                                    {connection.username}
                                                                    <span className="text-fg-disabled">
                                                                        @
                                                                        {connection.host}
                                                                    </span>
                                                                </p>
                                                                <CopyRow
                                                                    label="laravel"
                                                                    value={connection.laravel}
                                                                />
                                                                <CopyRow
                                                                    label="url"
                                                                    value={connection.url}
                                                                />
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </section>

                                        <section className="space-y-3">
                                            <h3 className="text-overline font-mono text-fg-subtle">
                                                recent backups
                                            </h3>

                                            {database.backups.length === 0 ? (
                                                <p className="text-[13px] leading-5 text-fg-muted">
                                                    No backups taken yet.
                                                </p>
                                            ) : (
                                                <DataTable density="dense">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableHeaderCell>
                                                                File
                                                            </TableHeaderCell>
                                                            <TableHeaderCell numeric>
                                                                Size
                                                            </TableHeaderCell>
                                                            <TableHeaderCell>
                                                                Status
                                                            </TableHeaderCell>
                                                            <TableHeaderCell />
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {database.backups.map(
                                                            (backup) => (
                                                                <TableRow
                                                                    key={backup.uuid}
                                                                >
                                                                    <TableCell>
                                                                        <span className="font-mono text-[12px] text-fg-muted">
                                                                            {backup.filename}
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell numeric>
                                                                        {bytes(
                                                                            backup.size_bytes,
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <StatusPill
                                                                            status={toStatus(
                                                                                backup.status,
                                                                            )}
                                                                            label={backup.status}
                                                                            size="sm"
                                                                        />
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        {backup.download_url && (
                                                                            <Button
                                                                                size="icon-sm"
                                                                                variant="ghost"
                                                                                asChild
                                                                                aria-label={`Download ${backup.filename}`}
                                                                            >
                                                                                <a
                                                                                    href={
                                                                                        backup.download_url
                                                                                    }
                                                                                >
                                                                                    <Download className="size-3.5" />
                                                                                </a>
                                                                            </Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ),
                                                        )}
                                                    </TableBody>
                                                </DataTable>
                                            )}
                                        </section>
                                    </div>
                                </Panel>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

DatabasesIndex.layout = {
    breadcrumbs: [{ title: 'Databases', href: databasesIndex() }],
};
