import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import {
    Check,
    Copy,
    Database,
    Download,
    ExternalLink,
    Globe,
    HardDriveDownload,
    Lock,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
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
import {
    store as storeDatabaseUser,
    destroy as destroyDatabaseUser,
} from '@/routes/database-users';
import {
    destroy as destroyDatabase,
    index as databasesIndex,
    store as storeDatabase,
} from '@/routes/databases';
import { update as updateDatabaseAccess } from '@/routes/databases/access';
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
    connect_host: string;
    remote: boolean;
    laravel: string;
    url: string;
    tableplus: string;
};

type DatabaseRow = {
    id: number;
    name: string;
    status: string;
    allow_remote: boolean;
    sites: SiteLinkRow[];
    users: DatabaseUserRow[];
    backups: DatabaseBackupRow[];
    connections: ConnectionRow[];
};

function ToggleSwitch({
    checked,
    onCheckedChange,
    id,
    disabled,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    id: string;
    disabled?: boolean;
}) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                checked
                    ? 'bg-[#18B69B]'
                    : 'bg-[#e2e8f0] dark:bg-[#3f4244]',
            )}
        >
            <span
                className={cn(
                    'pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform',
                    checked ? 'translate-x-5' : 'translate-x-0',
                )}
            />
        </button>
    );
}

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

function CopyButton({
    value,
    label,
    shortLabel = 'Copy link',
}: {
    value: string;
    label: string;
    shortLabel?: string;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <Button
            size="sm"
            variant="secondary"
            aria-label={label}
            onClick={() => {
                void navigator.clipboard.writeText(value);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
            }}
        >
            {copied ? (
                <Check className="size-3.5 text-[#18B69B]" />
            ) : (
                <Copy className="size-3.5" />
            )}
            {copied ? 'Copied' : shortLabel}
        </Button>
    );
}

function DatabaseCard({
    database,
    serverIp,
    onAddUser,
}: {
    database: DatabaseRow;
    serverIp: string;
    onAddUser: () => void;
}) {
    const [pendingRemote, setPendingRemote] = useState(false);
    const latestBackup = database.backups[0] ?? null;
    const remote = database.allow_remote;

    return (
        <ForgeDividedCard
            title={database.name}
            action={
                <div className="flex flex-wrap items-center gap-2">
                    <ForgeStatusBadge
                        label={remote ? 'Remote' : 'Local'}
                    />
                    <ConfirmDialog
                        trigger={
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={`Drop ${database.name}`}
                                disabled={database.sites.length > 0}
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
                            router.delete(destroyDatabase.url(database.id))
                        }
                    />
                </div>
            }
        >
            {/* Access */}
            <ForgeListRow className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                        className={cn(
                            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                            remote
                                ? 'bg-[#18B69B]/10 text-[#18B69B]'
                                : 'bg-[#f1f5f9] text-[#64748b] dark:bg-[#1f2123]',
                        )}
                    >
                        {remote ? (
                            <Globe className="size-4" />
                        ) : (
                            <Lock className="size-4" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                            <ToggleSwitch
                                id={`remote-access-${database.id}`}
                                checked={remote}
                                disabled={pendingRemote}
                                onCheckedChange={(checked) => {
                                    setPendingRemote(true);
                                    router.patch(
                                        updateDatabaseAccess.url(database.id),
                                        { allow_remote: checked },
                                        {
                                            onFinish: () =>
                                                setPendingRemote(false),
                                        },
                                    );
                                }}
                            />
                            <label
                                htmlFor={`remote-access-${database.id}`}
                                className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]"
                            >
                                Remote access
                            </label>
                        </div>
                        <p className="mt-1 text-xs text-[#64748b]">
                            {remote
                                ? `Open on ${serverIp}:3306 — TablePlus links use this IP.`
                                : 'Local only. Sites keep using 127.0.0.1. Turn on to connect from your laptop.'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Button size="sm" variant="secondary" onClick={onAddUser}>
                        <Users className="size-3.5" />
                        Add user
                    </Button>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                            router.post(storeBackup.url(database.id))
                        }
                    >
                        <HardDriveDownload className="size-3.5" />
                        Back up
                    </Button>
                </div>
            </ForgeListRow>

            {/* Sites */}
            {database.sites.length > 0 && (
                <ForgeListRow className="flex-wrap gap-2">
                    <span className="text-xs font-medium text-[#64748b]">
                        Used by
                    </span>
                    {database.sites.map((site) => (
                        <Link
                            key={site.id}
                            href={showSite(site.name)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] px-2 py-1 text-xs font-medium text-[#334155] transition-colors hover:border-[#18B69B]/40 hover:text-[#0f172a] dark:border-[#2e3032] dark:text-[#e2e8f0] dark:hover:border-[#18B69B]/40"
                        >
                            <SiteFrameworkIcon type={site.type} size="sm" />
                            {site.primary_domain}
                            <ExternalLink className="size-3 text-[#94a3b8]" />
                        </Link>
                    ))}
                </ForgeListRow>
            )}

            {/* Users */}
            {database.users.length === 0 ? (
                <ForgeListRow className="justify-center py-8 text-sm text-[#64748b]">
                    No users yet — add one to get a connection link.
                </ForgeListRow>
            ) : (
                database.users.map((user) => {
                    const connection = connectionForUser(database, user.id);

                    return (
                        <ForgeListRow
                            key={user.id}
                            className="flex-col items-stretch gap-3 sm:flex-row sm:items-center"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="font-mono text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    {user.username}
                                </p>
                                <p className="mt-1 text-xs text-[#64748b]">
                                    {formatPrivileges(user.privileges)}
                                    {remote
                                        ? ` · connects via ${serverIp}`
                                        : ' · local only'}
                                </p>
                            </div>

                            {connection ? (
                                remote ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            asChild
                                        >
                                            <a href={connection.tableplus}>
                                                Open in TablePlus
                                            </a>
                                        </Button>
                                        <CopyButton
                                            value={connection.url}
                                            label="Copy MySQL connection URL"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-[#94a3b8]">
                                        Turn on remote access to connect from
                                        TablePlus
                                    </p>
                                )
                            ) : null}

                            <ConfirmDialog
                                trigger={
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        aria-label={`Delete ${user.username}`}
                                        disabled={user.sites.length > 0}
                                        className="sm:ml-auto"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                }
                                title={`Delete ${user.username}?`}
                                description={
                                    user.sites.length > 0
                                        ? 'This user is linked to a site. Change the site database settings first.'
                                        : 'Removes the MySQL user and revokes all database access. This cannot be undone.'
                                }
                                confirmLabel="Delete user"
                                destructive
                                confirmationValue={user.username}
                                onConfirm={() =>
                                    router.delete(
                                        destroyDatabaseUser.url(user.id),
                                    )
                                }
                            />
                        </ForgeListRow>
                    );
                })
            )}

            {/* Backup */}
            {latestBackup && (
                <ForgeListRow className="flex-col items-stretch gap-2 border-t border-[#e2e8f0] bg-[#f8fafc] dark:border-[#2e3032] dark:bg-[#151718]">
                    <p className="text-xs font-medium text-[#64748b]">
                        Latest backup
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-[#64748b]">
                            {latestBackup.filename} ·{' '}
                            {bytes(latestBackup.size_bytes)}
                        </span>
                        <div className="flex items-center gap-2">
                            <ForgeStatusBadge label={latestBackup.status} />
                            {latestBackup.download_url && (
                                <Button size="sm" variant="ghost" asChild>
                                    <a href={latestBackup.download_url}>
                                        <Download className="size-3.5" />
                                        Download
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </ForgeListRow>
            )}
        </ForgeDividedCard>
    );
}

export default function DatabasesIndex({
    databases,
    server,
}: {
    databases: DatabaseRow[];
    server: { public_ip: string };
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [allowRemote, setAllowRemote] = useState(false);
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
        setAllowRemote(false);
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
                        <DialogTitle>Create a database user</DialogTitle>
                        <DialogDescription>
                            The password is generated by Beacon and shown once,
                            immediately after creation.
                        </DialogDescription>
                    </DialogHeader>

                    <Form
                        action={storeDatabaseUser()}
                        onSuccess={() => setUserOpen(false)}
                        onSubmit={(event) => {
                            const usernameError =
                                databaseUsernameError(databaseUserName);

                            setCreateUserNameError(usernameError);

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
                                                    event.target.value,
                                                );
                                                setCreateUserNameError(
                                                    undefined,
                                                );
                                            }}
                                        />
                                    </Field>

                                    <Field
                                        htmlFor="database_id"
                                        label="Database"
                                        required
                                        error={errors.database_id}
                                        help={
                                            databases.length === 0
                                                ? 'Create a database first.'
                                                : undefined
                                        }
                                    >
                                        <Select
                                            value={selectedDatabase}
                                            onValueChange={setSelectedDatabase}
                                        >
                                            <SelectTrigger id="database_id">
                                                <SelectValue placeholder="Select a database…" />
                                            </SelectTrigger>
                                            <SelectContent portalled={false}>
                                                {databases.map((database) => (
                                                    <SelectItem
                                                        key={database.id}
                                                        value={String(
                                                            database.id,
                                                        )}
                                                    >
                                                        {database.name}
                                                        {database.allow_remote
                                                            ? ' · remote'
                                                            : ' · local'}
                                                    </SelectItem>
                                                ))}
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
                                    >
                                        <Select
                                            value={privileges}
                                            onValueChange={(value) =>
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
                                            onClick={() => setUserOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={
                                            processing ||
                                            databases.length === 0 ||
                                            selectedDatabase === '' ||
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
                            Created as utf8mb4 with a utf8mb4_unicode_ci
                            collation. Leave remote off unless you need laptop
                            access.
                        </DialogDescription>
                    </DialogHeader>

                    <Form
                        action={storeDatabase()}
                        onSuccess={() => setCreateOpen(false)}
                        onSubmit={(event) => {
                            const nameError = databaseNameError(databaseName);

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
                                        error={createNameError ?? errors.name}
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
                                                    event.target.value,
                                                );
                                                setCreateNameError(undefined);
                                            }}
                                        />
                                    </Field>

                                    <label className="flex cursor-pointer items-start gap-3">
                                        <div className="mt-0.5">
                                            <ToggleSwitch
                                                id="allow_remote_create"
                                                checked={allowRemote}
                                                onCheckedChange={setAllowRemote}
                                            />
                                        </div>
                                        <span className="space-y-1">
                                            <span className="block text-[13px] font-medium leading-5 text-[#0f172a] dark:text-[#f8fafc]">
                                                Allow remote connections
                                            </span>
                                            <span className="block text-[13px] leading-5 text-[#64748b]">
                                                You can toggle this later.
                                                Connect from{' '}
                                                <span className="font-mono">
                                                    {server.public_ip}
                                                </span>
                                                .
                                            </span>
                                        </span>
                                    </label>
                                    <input
                                        type="hidden"
                                        name="allow_remote"
                                        value={allowRemote ? '1' : '0'}
                                    />
                                </DialogBody>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setCreateOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={
                                            processing ||
                                            databaseNameError(databaseName) !==
                                                undefined
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
                        Password shown once
                    </p>
                    <p className="mt-1 text-sm text-[#334155] dark:text-[#e2e8f0]">
                        Copy it now. Turn on{' '}
                        <strong>Remote access</strong> on the database, then use{' '}
                        <strong>Open in TablePlus</strong>. Beacon will not show
                        this password again.
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
                            description="Create a MySQL database, add a user, then flip remote access on when you need TablePlus."
                        />
                    }
                    sidebar={
                        <>
                            <ForgeDetailsSection title="Storage">
                                <ForgeDetailRow
                                    label="Databases"
                                    value="0"
                                />
                                <ForgeDetailRow label="Users" value="0" />
                                <ForgeDetailRow
                                    label="Server IP"
                                    value={server.public_ip}
                                />
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
                        <div className="space-y-6">
                            {databases.map((database) => (
                                <DatabaseCard
                                    key={database.id}
                                    database={database}
                                    serverIp={server.public_ip}
                                    onAddUser={() =>
                                        openCreateUserDialog(database.id)
                                    }
                                />
                            ))}
                        </div>
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
                                <ForgeDetailRow
                                    label="Server IP"
                                    value={server.public_ip}
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
