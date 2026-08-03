import { Form, Head, router, usePage } from '@inertiajs/react';
import { Copy, Database, Download, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type DatabaseUserRow = {
    id: number;
    username: string;
    privileges: string;
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
    users: DatabaseUserRow[];
    backups: DatabaseBackupRow[];
    connections: ConnectionRow[];
};

export default function DatabasesIndex({
    databases,
}: {
    databases: DatabaseRow[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [userOpen, setUserOpen] = useState(false);
    const [selectedDatabase, setSelectedDatabase] = useState<string>('');
    const [privileges, setPrivileges] = useState('all');

    const { flash } = usePage().props as {
        flash?: { database_user_password?: string };
    };

    return (
        <>
            <Head title="Databases" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        title="Databases"
                        description="Create MySQL databases and users for your sites."
                    />
                    <div className="flex gap-2">
                        <Dialog open={userOpen} onOpenChange={setUserOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Plus className="size-4" />
                                    New user
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        Create database user
                                    </DialogTitle>
                                    <DialogDescription>
                                        Creates a MySQL user on localhost.
                                        Optionally grant access to an existing
                                        database.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form
                                    {...storeDatabaseUser.form()}
                                    onSuccess={() => setUserOpen(false)}
                                    className="grid gap-4"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="username">
                                                    Username
                                                </Label>
                                                <Input
                                                    id="username"
                                                    name="username"
                                                    autoComplete="off"
                                                />
                                                <InputError
                                                    message={errors.username}
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="database_id">
                                                    Database
                                                </Label>
                                                <Select
                                                    value={selectedDatabase}
                                                    onValueChange={
                                                        setSelectedDatabase
                                                    }
                                                >
                                                    <SelectTrigger id="database_id">
                                                        <SelectValue placeholder="No database (user only)" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">
                                                            No database
                                                        </SelectItem>
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
                                                {selectedDatabase !== 'none' &&
                                                    selectedDatabase !== '' && (
                                                        <input
                                                            type="hidden"
                                                            name="database_id"
                                                            value={
                                                                selectedDatabase
                                                            }
                                                        />
                                                    )}
                                            </div>
                                            {selectedDatabase !== 'none' &&
                                                selectedDatabase !== '' && (
                                                    <>
                                                        <div className="grid gap-2">
                                                            <Label htmlFor="privileges">
                                                                Privileges
                                                            </Label>
                                                            <Select
                                                                value={
                                                                    privileges
                                                                }
                                                                onValueChange={
                                                                    setPrivileges
                                                                }
                                                            >
                                                                <SelectTrigger id="privileges">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="all">
                                                                        Full
                                                                        access
                                                                    </SelectItem>
                                                                    <SelectItem value="readonly">
                                                                        Read
                                                                        only
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <input
                                                                type="hidden"
                                                                name="privileges"
                                                                value={
                                                                    privileges
                                                                }
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create user
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="size-4" />
                                    New database
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create database</DialogTitle>
                                    <DialogDescription>
                                        Provisions a new MySQL database on this
                                        server.
                                    </DialogDescription>
                                </DialogHeader>
                                <Form
                                    {...storeDatabase.form()}
                                    onSuccess={() => setCreateOpen(false)}
                                    className="grid gap-4"
                                >
                                    {({ errors, processing }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="name">
                                                    Database name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    placeholder="app_production"
                                                    autoComplete="off"
                                                />
                                                <InputError
                                                    message={errors.name}
                                                />
                                            </div>
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create database
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {flash?.database_user_password && (
                    <Card className="border-amber-500/40 bg-amber-500/5">
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                            <div>
                                <p className="font-medium">
                                    Save this password now
                                </p>
                                <p className="font-mono text-xs">
                                    {flash.database_user_password}
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    void navigator.clipboard.writeText(
                                        flash.database_user_password ?? '',
                                    )
                                }
                            >
                                <Copy className="size-3.5" />
                                Copy
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {databases.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                            <Database className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                No databases yet. Create one to get started.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    databases.map((database) => (
                        <Card key={database.id}>
                            <CardHeader className="flex flex-row items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="font-mono text-base">
                                        {database.name}
                                    </CardTitle>
                                    <StatusBadge
                                        status="success"
                                        label={database.status}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            router.post(
                                                storeBackup.url(database.id),
                                            )
                                        }
                                    >
                                        Backup
                                    </Button>
                                    <ConfirmDialog
                                        trigger={
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                            >
                                                <Trash2 className="size-3.5" />
                                                Delete
                                            </Button>
                                        }
                                        title={`Delete ${database.name}?`}
                                        description="This drops the database from MySQL and removes all user grants."
                                        confirmLabel="Delete database"
                                        destructive
                                        onConfirm={() =>
                                            router.delete(
                                                destroyDatabase.url(
                                                    database.id,
                                                ),
                                            )
                                        }
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {database.connections.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">
                                            Connection strings
                                        </p>
                                        {database.connections.map(
                                            (connection) => (
                                                <div
                                                    key={connection.user_id}
                                                    className="rounded-lg border p-3"
                                                >
                                                    <div className="mb-2 flex items-center justify-between gap-2">
                                                        <span className="font-mono text-xs">
                                                            {
                                                                connection.username
                                                            }
                                                            @{connection.host}
                                                        </span>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                void navigator.clipboard.writeText(
                                                                    connection.laravel,
                                                                )
                                                            }
                                                        >
                                                            <Copy className="size-3.5" />
                                                            Copy .env
                                                        </Button>
                                                    </div>
                                                    <pre className="overflow-x-auto rounded bg-muted/50 p-2 font-mono text-xs whitespace-pre-wrap">
                                                        {connection.laravel}
                                                    </pre>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                                {database.backups.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm font-medium">
                                            Recent backups
                                        </p>
                                        {database.backups.map((backup) => (
                                            <div
                                                key={backup.uuid}
                                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                                            >
                                                <div>
                                                    <p className="font-mono text-xs">
                                                        {backup.filename}
                                                    </p>
                                                    <StatusBadge
                                                        status={
                                                            backup.status ===
                                                            'success'
                                                                ? 'success'
                                                                : backup.status ===
                                                                    'failed'
                                                                  ? 'failed'
                                                                  : 'running'
                                                        }
                                                        label={backup.status}
                                                    />
                                                </div>
                                                {backup.download_url && (
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="sm"
                                                    >
                                                        <a
                                                            href={
                                                                backup.download_url
                                                            }
                                                        >
                                                            <Download className="size-3.5" />
                                                            Download
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {database.users.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No users linked to this database.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {database.users.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                                            >
                                                <span className="font-mono">
                                                    {user.username}@localhost
                                                </span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                    {user.privileges}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </>
    );
}

DatabasesIndex.layout = {
    breadcrumbs: [{ title: 'Databases', href: databasesIndex() }],
};
