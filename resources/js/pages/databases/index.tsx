import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    Database,
    Download,
    ExternalLink,
    HardDriveDownload,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
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
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import {
    ForgeActionsPanel,
    ForgeActionGroup,
    ForgeEmptyState,
} from '@/components/forge/forge-empty-state';
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
import { store as storeDatabaseUser, destroy as destroyDatabaseUser } from '@/routes/database-users';
import {
    destroy as destroyDatabase,
    index as databasesIndex,
    store as storeDatabase,
} from '@/routes/databases';
import { store as storeBackup } from '@/routes/databases/backups';
import { show as showSite } from '@/routes/sites';
import {
    databaseNameError,
    databaseUsernameError,
} from '@/lib/validation';

type DatabaseUserRow = {
    id: number;
    username: string;
    host: string;
    privileges: string;
    sites: SiteLinkRow[];
};

type SiteLinkRow = {
    id: number;
    name: string;
    type: string;
    primary_domain: string;
};

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
    sites: SiteLinkRow[];
    users: DatabaseUserRow[];
    backups: DatabaseBackupRow[];
    connections: ConnectionRow[];
};

function formatPrivileges(privileges: string): string {
    return privileges === 'readonly' ? 'Read only' : 'Full access';
}

function connectionForUser(
    database: DatabaseRow,
    userId: number,
): ConnectionRow | undefined {
    return database.connections.find(
        (connection) => connection.user_id === userId,
    );
}

/** Linked sites shown as chips with quick navigation to the site. */
function SiteLinks({ sites }: { sites: SiteLinkRow[] }) {
    if (sites.length === 0) {
        return (
            <p className="text-sm text-[#64748b]">
                No sites linked yet.
            </p>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {sites.map((site) => (
                <Link
                    key={site.id}
                    href={showSite(site.name)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm transition-colors hover:border-[#cbd5e1] dark:border-[#2e3032] dark:bg-[#151718] dark:hover:border-[#3f4244]"
                >
                    <SiteFrameworkIcon type={site.type} size="sm" />
                    <span className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                        {site.primary_domain}
                    </span>
                    <ExternalLink className="size-3 text-[#94a3b8]" />
                </Link>
            ))}
        </div>
    );
}

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
    const [selectedDatabase, setSelectedDatabase] = useState('');
    const [privileges, setPrivileges] = useState<'all' | 'readonly'>('all');
    const [databaseName, setDatabaseName] = useState('');
    const [databaseUserName, setDatabaseUserName] = useState('');
    const [createNameError, setCreateNameError] = useState<string>();
    const [createUserNameError, setCreateUserNameError] = useState<string>();
    const [prefillDatabaseId, setPrefillDatabaseId] = useState('');

    function openCreateUserDialog(databaseId?: number): void {
        setPrefillDatabaseId(databaseId ? String(databaseId) : '');
        setUserOpen(true);
    }

    useEffect(() => {
        if (!userOpen) {
            return;
        }

        setPrivileges('all');
        setDatabaseUserName('');
        setCreateUserNameError(undefined);
        setSelectedDatabase(
            prefillDatabaseId ||
                (databases.length === 1 ? String(databases[0].id) : ''),
        );
    }, [userOpen, databases, prefillDatabaseId]);

    useEffect(() => {
        if (!createOpen) {
            return;
        }

        setDatabaseName('');
        setCreateNameError(undefined);
    }, [createOpen]);

    const page = usePage<{
        flash?: { database_user_password?: string | null };
    }>();
    const revealedPassword = page.props.flash?.database_user_password ?? null;

    const totalUsers = databases.reduce(
        (total, database) => total + database.users.length,
        0,
    );

    const sidebarActions = (
        <ForgeActionGroup layout="vertical">
            <Dialog
                open={userOpen}
                onOpenChange={(open) => {
                    setUserOpen(open);

                    if (!open) {
                        setPrefillDatabaseId('');
                    }
                }}
            >
                <DialogTrigger asChild>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={databases.length === 0}
                        onClick={() => openCreateUserDialog()}
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
                                        onSubmit={(event) => {
                                            const usernameError =
                                                databaseUsernameError(
                                                    databaseUserName,
                                                );

                                            setCreateUserNameError(
                                                usernameError,
                                            );

                                            if (usernameError) {
                                                event.preventDefault();
                                            }
                                        }}
                                        className="contents"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <DialogBody className="space-y-4">
                                                <Field
                                                    htmlFor="username"
                                                    label="Username"
                                                    required
                                                    error={
                                                        createUserNameError ??
                                                        errors.username
                                                    }
                                                    help="Letters, numbers, and underscores only."
                                                >
                                                    <Input
                                                        id="username"
                                                        name="username"
                                                        mono
                                                        autoComplete="off"
                                                        placeholder="app_user"
                                                        value={databaseUserName}
                                                        onChange={(event) => {
                                                            setDatabaseUserName(
                                                                event.target
                                                                    .value,
                                                            );
                                                            setCreateUserNameError(
                                                                undefined,
                                                            );
                                                        }}
                                                    />
                                                </Field>

                                                <Field
                                                    htmlFor="database_id"
                                                    label="Database access"
                                                    required
                                                    error={errors.database_id}
                                                    help={
                                                        databases.length === 0
                                                            ? 'Create a database first.'
                                                            : 'Grant this user access to one database.'
                                                    }
                                                >
                                                    <Select
                                                        value={selectedDatabase}
                                                        onValueChange={
                                                            setSelectedDatabase
                                                        }
                                                    >
                                                        <SelectTrigger id="database_id">
                                                            <SelectValue placeholder="Select a database…" />
                                                        </SelectTrigger>
                                                        <SelectContent portalled={false}>
                                                            {databases.map(
                                                                (database) => (
                                                                    <SelectItem
                                                                        key={
                                                                            database.id
                                                                        }
                                                                        value={String(
                                                                            database.id,
                                                                        )}
                                                                    >
                                                                        {
                                                                            database.name
                                                                        }
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <input
                                                        type="hidden"
                                                        name="database_id"
                                                        value={selectedDatabase}
                                                    />
                                                </Field>

                                                <Field
                                                    htmlFor="privileges"
                                                    label="Privileges"
                                                    required
                                                    error={errors.privileges}
                                                    help="Full access is required for Laravel migrations and writes."
                                                >
                                                    <Select
                                                        value={privileges}
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            setPrivileges(
                                                                value as
                                                                    | 'all'
                                                                    | 'readonly',
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger id="privileges">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent portalled={false}>
                                                            <SelectItem value="all">
                                                                Full access
                                                            </SelectItem>
                                                            <SelectItem value="readonly">
                                                                Read only
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <input
                                                        type="hidden"
                                                        name="privileges"
                                                        value={privileges}
                                                    />
                                                </Field>
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
                                                        disabled={
                                                            processing ||
                                                            databases.length ===
                                                                0 ||
                                                            selectedDatabase ===
                                                                '' ||
                                                            databaseUsernameError(
                                                                databaseUserName,
                                                            ) !== undefined
                                                        }
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
                                        onSubmit={(event) => {
                                            const nameError =
                                                databaseNameError(databaseName);

                                            setCreateNameError(nameError);

                                            if (nameError) {
                                                event.preventDefault();
                                            }
                                        }}
                                        className="contents"
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <DialogBody className="space-y-4">
                                                <Field
                                                    htmlFor="name"
                                                    label="Name"
                                                    required
                                                    error={
                                                        createNameError ??
                                                        errors.name
                                                    }
                                                    help="Letters, numbers and underscores only."
                                                >
                                                    <Input
                                                        id="name"
                                                        name="name"
                                                        mono
                                                        autoFocus
                                                        autoComplete="off"
                                                        placeholder="app_production"
                                                        value={databaseName}
                                                        onChange={(event) => {
                                                            setDatabaseName(
                                                                event.target
                                                                    .value,
                                                            );
                                                            setCreateNameError(
                                                                undefined,
                                                            );
                                                        }}
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
                                                        disabled={
                                                            processing ||
                                                            databaseNameError(
                                                                databaseName,
                                                            ) !== undefined
                                                        }
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
                                {sidebarActions}
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
                                        <div className="flex flex-wrap items-center gap-2">
                                            {database.sites.length > 0 && (
                                                <span className="text-xs text-[#64748b]">
                                                    {database.sites.length}{' '}
                                                    {database.sites.length === 1
                                                        ? 'site'
                                                        : 'sites'}
                                                </span>
                                            )}
                                            <ForgeStatusBadge
                                                label={database.status}
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() =>
                                                    openCreateUserDialog(
                                                        database.id,
                                                    )
                                                }
                                            >
                                                <Users className="size-3.5" />
                                                Add user
                                            </Button>
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
                                                        disabled={
                                                            database.sites
                                                                .length > 0
                                                        }
                                                    >
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                }
                                                title={`Drop ${database.name}?`}
                                                description={
                                                    database.sites.length > 0
                                                        ? 'Detach all sites from this database before dropping it.'
                                                        : 'Every table and all of its data is destroyed. This cannot be undone.'
                                                }
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
                                    {database.sites.length > 0 && (
                                        <ForgeListRow className="flex-col items-stretch gap-2 border-b border-[#e2e8f0] dark:border-[#2e3032]">
                                            <p className="text-xs font-semibold tracking-wide text-[#64748b] uppercase">
                                                Linked sites
                                            </p>
                                            <SiteLinks sites={database.sites} />
                                        </ForgeListRow>
                                    )}

                                    <ForgeListRow className="flex-col items-stretch gap-4">
                                        <div className="flex w-full items-center justify-between gap-3">
                                            <h3 className="text-xs font-semibold tracking-wide text-[#64748b] uppercase">
                                                Users
                                            </h3>
                                            <span className="text-xs text-[#64748b]">
                                                {database.users.length}{' '}
                                                {database.users.length === 1
                                                    ? 'user'
                                                    : 'users'}
                                            </span>
                                        </div>

                                        {database.users.length === 0 ? (
                                            <div className="rounded-md border border-dashed border-[#e2e8f0] px-4 py-5 text-center dark:border-[#2e3032]">
                                                <p className="text-sm text-[#64748b]">
                                                    No users yet. Create one to
                                                    get connection strings for
                                                    this database.
                                                </p>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="mt-3"
                                                    onClick={() =>
                                                        openCreateUserDialog(
                                                            database.id,
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-3.5" />
                                                    Add user
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {database.users.map((user) => {
                                                    const connection =
                                                        connectionForUser(
                                                            database,
                                                            user.id,
                                                        );

                                                    return (
                                                        <div
                                                            key={user.id}
                                                            className="space-y-3 rounded-md border border-[#e2e8f0] p-3 dark:border-[#2e3032]"
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div className="space-y-2">
                                                                    <p className="font-mono text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                                        {
                                                                            user.username
                                                                        }
                                                                        <span className="text-[#94a3b8]">
                                                                            @
                                                                            {
                                                                                user.host
                                                                            }
                                                                        </span>
                                                                    </p>
                                                                    <ForgeStatusBadge
                                                                        label={formatPrivileges(
                                                                            user.privileges,
                                                                        )}
                                                                    />
                                                                </div>

                                                                <ConfirmDialog
                                                                    trigger={
                                                                        <Button
                                                                            size="icon-sm"
                                                                            variant="ghost"
                                                                            aria-label={`Delete ${user.username}`}
                                                                            disabled={
                                                                                user
                                                                                    .sites
                                                                                    .length >
                                                                                0
                                                                            }
                                                                        >
                                                                            <Trash2 className="size-3.5" />
                                                                        </Button>
                                                                    }
                                                                    title={`Delete ${user.username}?`}
                                                                    description={
                                                                        user
                                                                            .sites
                                                                            .length >
                                                                        0
                                                                            ? 'This user is linked to a site. Change the site database settings first.'
                                                                            : 'Removes the MySQL user and revokes all database access. This cannot be undone.'
                                                                    }
                                                                    confirmLabel="Delete user"
                                                                    destructive
                                                                    confirmationValue={
                                                                        user.username
                                                                    }
                                                                    onConfirm={() =>
                                                                        router.delete(
                                                                            destroyDatabaseUser.url(
                                                                                user.id,
                                                                            ),
                                                                        )
                                                                    }
                                                                />
                                                            </div>

                                                            {connection ? (
                                                                <div className="space-y-2 border-t border-[#e2e8f0] pt-3 dark:border-[#2e3032]">
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
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
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
                                {sidebarActions}
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
