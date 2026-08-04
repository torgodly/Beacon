import { useMemo } from 'react';
import InputError from '@/components/input-error';
import {
    ForgeFormPreview,
    ForgeFormRow,
    ForgeFormRows,
    ForgeFormTabs,
} from '@/components/forge/forge-form-row';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

type AppEnv = 'testing' | 'staging' | 'production';
type DatabaseDriver = 'mysql' | 'sqlite';
type DatabaseStrategy = 'none' | 'create' | 'existing';

type DatabaseOption = { id: number; name: string };

const APP_ENV_TABS = [
    { value: 'production', label: 'Production' },
    { value: 'staging', label: 'Staging' },
    { value: 'testing', label: 'Testing' },
] as const;

const DATABASE_DRIVER_TABS = [
    { value: 'mysql', label: 'MySQL' },
    { value: 'sqlite', label: 'SQLite' },
] as const;

const MYSQL_STRATEGY_TABS = [
    { value: 'create', label: 'Create new' },
    { value: 'existing', label: 'Existing' },
    { value: 'none', label: 'None' },
] as const;

function suggestDatabaseName(domain: string): string {
    const normalized = domain
        .trim()
        .toLowerCase()
        .replace(/[.-]/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '');

    return (normalized || 'site').slice(0, 64);
}

function envDescription(appEnv: AppEnv): string {
    return matchAppEnv(appEnv, {
        production: 'Live traffic · debug off',
        staging: 'Pre-release · debug off',
        testing: 'Experiments · debug on',
    });
}

function matchAppEnv<T>(
    appEnv: AppEnv,
    options: Record<AppEnv, T>,
): T {
    return options[appEnv];
}

type CreateSiteLaravelStackProps = {
    appEnv: AppEnv;
    setAppEnv: (value: AppEnv) => void;
    databaseDriver: DatabaseDriver;
    setDatabaseDriver: (value: DatabaseDriver) => void;
    databaseStrategy: DatabaseStrategy;
    setDatabaseStrategy: (value: DatabaseStrategy) => void;
    databaseId: string;
    setDatabaseId: (value: string) => void;
    databaseName: string;
    setDatabaseName: (value: string) => void;
    redisEnabled: boolean;
    setRedisEnabled: (value: boolean) => void;
    siteName: string;
    databases: DatabaseOption[];
    errors: Partial<
        Record<
            | 'app_env'
            | 'database_driver'
            | 'database_strategy'
            | 'database_id'
            | 'database_name'
            | 'redis_enabled',
            string
        >
    >;
};

export function CreateSiteLaravelStack({
    appEnv,
    setAppEnv,
    databaseDriver,
    setDatabaseDriver,
    databaseStrategy,
    setDatabaseStrategy,
    databaseId,
    setDatabaseId,
    databaseName,
    setDatabaseName,
    redisEnabled,
    setRedisEnabled,
    siteName,
    databases,
    errors,
}: CreateSiteLaravelStackProps) {
    const envPreview = useMemo(() => {
        const lines = [
            `APP_ENV=${appEnv}`,
            `APP_DEBUG=${appEnv === 'testing' ? 'true' : 'false'}`,
            databaseDriver === 'sqlite'
                ? 'DB_CONNECTION=sqlite'
                : 'DB_CONNECTION=mysql',
            redisEnabled
                ? 'CACHE_STORE=redis · QUEUE_CONNECTION=redis · SESSION_DRIVER=redis'
                : 'CACHE_STORE=file · QUEUE_CONNECTION=database · SESSION_DRIVER=file',
        ];

        if (databaseDriver === 'sqlite') {
            lines.push('DB_DATABASE=database/database.sqlite');
        } else if (databaseStrategy === 'create' && databaseName) {
            lines.push(`DB_DATABASE=${databaseName}`);
        } else if (databaseStrategy === 'existing' && databaseId) {
            const selected = databases.find(
                (database) => String(database.id) === databaseId,
            );
            if (selected) {
                lines.push(`DB_DATABASE=${selected.name}`);
            }
        }

        return lines.join('\n');
    }, [
        appEnv,
        databaseDriver,
        databaseId,
        databaseName,
        databaseStrategy,
        databases,
        redisEnabled,
    ]);

    return (
        <div className="space-y-3">
            <input type="hidden" name="app_env" value={appEnv} />
            <input type="hidden" name="database_driver" value={databaseDriver} />
            <input
                type="hidden"
                name="redis_enabled"
                value={redisEnabled ? '1' : '0'}
            />

            <ForgeFormRows>
                <ForgeFormRow label="Environment">
                    <div className="space-y-2">
                        <ForgeFormTabs
                            tabs={[...APP_ENV_TABS]}
                            value={appEnv}
                            onChange={(value) => setAppEnv(value as AppEnv)}
                        />
                        <p className="text-[13px] leading-5 text-fg-muted">
                            {envDescription(appEnv)}
                        </p>
                        <InputError message={errors.app_env} />
                    </div>
                </ForgeFormRow>

                <ForgeFormRow label="Database">
                    <div className="space-y-2">
                        <ForgeFormTabs
                            tabs={[...DATABASE_DRIVER_TABS]}
                            value={databaseDriver}
                            onChange={(value) => {
                                const driver = value as DatabaseDriver;
                                setDatabaseDriver(driver);

                                if (driver === 'mysql') {
                                    setDatabaseStrategy('create');
                                    setDatabaseName(
                                        suggestDatabaseName(siteName),
                                    );
                                }
                            }}
                        />
                        <InputError message={errors.database_driver} />
                    </div>
                </ForgeFormRow>

                {databaseDriver === 'mysql' && (
                    <>
                        <input
                            type="hidden"
                            name="database_strategy"
                            value={databaseStrategy}
                        />

                        <ForgeFormRow label="MySQL">
                            <div className="space-y-3">
                                <ForgeFormTabs
                                    tabs={[...MYSQL_STRATEGY_TABS]}
                                    value={databaseStrategy}
                                    onChange={(value) => {
                                        const strategy =
                                            value as DatabaseStrategy;
                                        setDatabaseStrategy(strategy);

                                        if (strategy === 'create') {
                                            setDatabaseName(
                                                suggestDatabaseName(siteName),
                                            );
                                        }
                                    }}
                                />
                                <InputError message={errors.database_strategy} />

                                {databaseStrategy === 'create' && (
                                    <Field
                                        htmlFor="database_name"
                                        label="Database name"
                                        required
                                        error={errors.database_name}
                                        help="Letters, numbers, and underscores only."
                                    >
                                        <Input
                                            id="database_name"
                                            name="database_name"
                                            mono
                                            autoComplete="off"
                                            spellCheck={false}
                                            placeholder="app_example_com"
                                            value={databaseName}
                                            onChange={(event) =>
                                                setDatabaseName(
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </Field>
                                )}

                                {databaseStrategy === 'existing' && (
                                    <Field
                                        htmlFor="database_id"
                                        label="Existing database"
                                        required
                                        error={errors.database_id}
                                        help={
                                            databases.length === 0
                                                ? 'No databases yet — create one from the Databases page.'
                                                : 'Beacon creates a dedicated user with full access.'
                                        }
                                    >
                                        <Select
                                            value={databaseId}
                                            onValueChange={setDatabaseId}
                                            name="database_id"
                                            disabled={databases.length === 0}
                                        >
                                            <SelectTrigger id="database_id">
                                                <SelectValue placeholder="Select a database" />
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
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            </div>
                        </ForgeFormRow>
                    </>
                )}

                {databaseDriver === 'sqlite' && (
                    <ForgeFormRow label="SQLite">
                        <p className="text-[13px] leading-5 text-fg-muted">
                            File at{' '}
                            <code className="font-mono text-fg-code">
                                database/database.sqlite
                            </code>{' '}
                            — created on first deploy.
                        </p>
                    </ForgeFormRow>
                )}

                <ForgeFormRow label="Redis">
                    <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                            checked={redisEnabled}
                            onCheckedChange={(checked) =>
                                setRedisEnabled(checked === true)
                            }
                            className="mt-0.5"
                        />
                        <span className="space-y-1">
                            <span className="block text-[13px] font-medium leading-5 text-fg">
                                Use Redis for cache, queue, and sessions
                            </span>
                            <span className="block text-[13px] leading-5 text-fg-muted">
                                Requires Redis on this server.
                            </span>
                        </span>
                    </label>
                </ForgeFormRow>

                <ForgeFormPreview label="Deploy preview">
                    {envPreview}
                </ForgeFormPreview>
            </ForgeFormRows>
        </div>
    );
}

export { suggestDatabaseName };
