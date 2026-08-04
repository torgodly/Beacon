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
import { EmptyState } from '@/components/console/page-header';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import {
    ForgeActionsPanel,
    ForgeActionGroup,
    ForgeEmptyState,
} from '@/components/forge/forge-empty-state';
import InputError from '@/components/input-error';
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
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
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

    const headerActions = (
        <ForgeActionGroup layout="vertical">
            <Dialog open={userOpen} onOpenChange={setUserOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={databases.length === 0}
                    >
                        <Users />
                        New user
                    </Button>
                </DialogTrigger>
                                <DialogContent size="md">
                                    <DialogHeader
                                        tone="brand"
                                        eyebrow="Access control"
                                        icon={<Users className="size-5" />}
                                    >
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
                                        className="contents"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <DialogBody className="space-y-4">
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
                                                </DialogBody>

                                                <DialogFooter>
                                                    <DialogClose asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                setUserOpen(false)
                                                            }
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </DialogClose>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={processing}
                                                    >
                                                        {processing
                                                            ? 'Creating…'
                                                            : 'Create user'}
                                                    </Button>
                                                </DialogFooter>
                                            </>
                                        )}
                                    </Form>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="primary" size="sm">
                                        <Plus />
                                        New database
                                    </Button>
                                </DialogTrigger>
                                <DialogContent size="sm">
                                    <DialogHeader
                                        tone="brand"
                                        eyebrow="MySQL"
                                        icon={<Database className="size-5" />}
                                    >
                                        <DialogTitle>Create a database</DialogTitle>
                                        <DialogDescription>
                                            Created as utf8mb4 with a
                                            utf8mb4_unicode_ci collation.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <Form
                                        action={storeDatabase()}
                                        onSuccess={() => setCreateOpen(false)}
                                        className="contents"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <DialogBody className="space-y-4">
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
                                                </DialogBody>

                                                <DialogFooter>
                                                    <DialogClose asChild>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                setCreateOpen(false)
                                                            }
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </DialogClose>
                                                    <Button
                                                        type="submit"
                                                        variant="primary"
                                                        disabled={processing}
                                                    >
                                                        {processing
                                                            ? 'Creating…'
                                                            : 'Create database'}
                                                    </Button>
                                                </DialogFooter>
                                            </>
                                        )}
                                    </Form>
                                </DialogContent>
                            </Dialog>
        </ForgeActionGroup>
    );

    return (
        <>
            <Head title="Databases" />

            {revealedPassword && (
                <div
                    role="alert"
                    className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3"
                >
                    <p className="text-xs font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-400">
                        Shown once
                    </p>
                    <p className="mt-1 text-sm text-[#334155] dark:text-[#e2e8f0]">
                        Copy this password now — Beacon stores it encrypted and
                        will not display it again.
                    </p>
                    <code className="mt-2 block rounded-md bg-white px-2 py-1.5 font-mono text-xs text-[#0f172a] dark:bg-[#151718] dark:text-[#f8fafc]">
                        {revealedPassword}
                    </code>
                </div>
            )}

            {databases.length === 0 ? (
                <ForgePageLayout
                    main={
                        <ForgeEmptyState
                            icon={Database}
                            title="No databases yet"
                            description="Create a MySQL database and Beacon will hand you a ready-to-paste connection string."
                        />
                    }
                    sidebar={
                        <>
                            <ForgeDetailsSection title="Storage">
                                <ForgeDetailRow label="Databases" value="0" />
                                <ForgeDetailRow label="Users" value="0" />
                            </ForgeDetailsSection>
                            <ForgeActionsPanel>
                                {headerActions}
                            </ForgeActionsPanel>
                        </>
                    }
                />
            ) : (
                <ForgePageLayout
                    main={
                        <>
                            {databases.map((database) => (
                                <ForgeDividedCard
                                    key={database.id}
                                    title={database.name}
                                    action={
                                        <div className="flex items-center gap-2">
                                            <ForgeStatusBadge
                                                label={database.status}
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    router.post(
                                                        storeBackup.url(
                                                            database.id,
                                                        ),
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
                                        </div>
                                    }
                                >
                                    <ForgeListRow className="flex-col items-stretch gap-4">
                                        <div className="w-full space-y-3">
                                            <h3 className="text-xs font-semibold tracking-wide text-[#64748b] uppercase">
                                                Connection strings
                                            </h3>
                                            {database.connections.length === 0 ? (
                                                <p className="text-sm text-[#64748b]">
                                                    Create a user to get a
                                                    connection string.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {database.connections.map(
                                                        (connection) => (
                                                            <div
                                                                key={
                                                                    connection.user_id
                                                                }
                                                                className="space-y-2 rounded-md border border-[#e2e8f0] p-3 dark:border-[#2e3032]"
                                                            >
                                                                <p className="font-mono text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                                    {
                                                                        connection.username
                                                                    }
                                                                    <span className="text-[#94a3b8]">
                                                                        @
                                                                        {
                                                                            connection.host
                                                                        }
                                                                    </span>
                                                                </p>
                                                                <CopyRow
                                                                    label="laravel"
                                                                    value={
                                                                        connection.laravel
                                                                    }
                                                                />
                                                                <CopyRow
                                                                    label="url"
                                                                    value={
                                                                        connection.url
                                                                    }
                                                                />
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </ForgeListRow>

                                    <ForgeListRow className="flex-col items-stretch gap-3">
                                        <h3 className="text-xs font-semibold tracking-wide text-[#64748b] uppercase">
                                            Recent backups
                                        </h3>
                                        {database.backups.length === 0 ? (
                                            <p className="text-sm text-[#64748b]">
                                                No backups taken yet.
                                            </p>
                                        ) : (
                                            <div className="w-full overflow-x-auto">
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
                                                                    key={
                                                                        backup.uuid
                                                                    }
                                                                >
                                                                    <TableCell>
                                                                        <span className="font-mono text-xs text-[#64748b]">
                                                                            {
                                                                                backup.filename
                                                                            }
                                                                        </span>
                                                                    </TableCell>
                                                                    <TableCell numeric>
                                                                        {bytes(
                                                                            backup.size_bytes,
                                                                        )}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <ForgeStatusBadge
                                                                            label={
                                                                                backup.status
                                                                            }
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
                                            </div>
                                        )}
                                    </ForgeListRow>
                                </ForgeDividedCard>
                            ))}
                        </>
                    }
                    sidebar={
                        <>
                            <ForgeDetailsSection title="Storage">
                                <ForgeDetailRow
                                    label="Databases"
                                    value={String(databases.length)}
                                />
                                <ForgeDetailRow
                                    label="Users"
                                    value={String(totalUsers)}
                                />
                            </ForgeDetailsSection>
                            <ForgeActionsPanel>
                                {headerActions}
                            </ForgeActionsPanel>
                        </>
                    }
                />
            )}
        </>
    );
}

DatabasesIndex.layout = {
    breadcrumbs: [{ title: 'Databases', href: databasesIndex() }],
};
