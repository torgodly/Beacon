import { Form, Head, Link } from '@inertiajs/react';
import {
    ChevronRight,
    Database,
    GitBranch,
    Globe,
    Plus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import {
    ForgeFrameworkBadge,
    ForgeStatusBadge,
} from '@/components/forge/forge-badge';
import {
    ForgeActionsPanel,
    ForgeEmptyState,
} from '@/components/forge/forge-empty-state';
import InputError from '@/components/input-error';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import {
    SearchableCombobox,
    type SearchableComboboxOption,
} from '@/components/searchable-combobox';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogSection,
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
import { cn } from '@/lib/utils';
import {
    branches as githubBranchRoute,
    remoteBranches as githubRemoteBranchRoute,
    repositories as githubRepositoryRoute,
} from '@/routes/github';
import { index as sitesIndex, show, store } from '@/routes/sites';

type GitHubRepositoryOption = {
    id: number;
    full_name: string;
    clone_url: string;
    ssh_url: string;
    default_branch: string | null;
};

type SiteRow = {
    id: string;
    name: string;
    type: string;
    status: string;
    ssl_status: string;
    deployment_status: string;
    repository: string | null;
    repository_branch: string;
    repository_connected: boolean;
    primary_domain: string;
};

/** Each type declares the runtime it needs, so the form can hide the rest. */
type SiteTypeOption = {
    value: string;
    label: string;
    description: string;
    runtime: 'php' | 'node' | 'none';
    web_directory: string | null;
};

type RuntimeOption = { value: string; label: string; is_default: boolean };

type DatabaseOption = { id: number; name: string };

type DatabaseStrategy = 'none' | 'create' | 'existing';

function suggestDatabaseName(domain: string): string {
    const normalized = domain
        .trim()
        .toLowerCase()
        .replace(/[.-]/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/^_+|_+$/g, '');

    return (normalized || 'site').slice(0, 64);
}

/** Sensible document roots per type, offered as one-click presets. */
const WEB_DIRECTORY_PRESETS: Record<string, string[]> = {
    laravel: ['/public'],
    static: ['/', '/dist', '/build', '/out', '/public'],
    nextjs: [],
    nuxt: [],
};

export default function SitesIndex({
    sites,
    siteTypes,
    phpVersions,
    nodeVersions,
    packageManager,
    github,
    databases,
}: {
    sites: SiteRow[];
    siteTypes: SiteTypeOption[];
    phpVersions: RuntimeOption[];
    nodeVersions: RuntimeOption[];
    packageManager: string;
    github: { connected: boolean };
    databases: DatabaseOption[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [siteType, setSiteType] = useState('laravel');

    const selected = siteTypes.find((type) => type.value === siteType);
    const runtime = selected?.runtime ?? 'none';

    const defaultPhp =
        phpVersions.find((version) => version.is_default)?.value ??
        phpVersions[0]?.value ??
        '';
    const defaultNode =
        nodeVersions.find((version) => version.is_default)?.value ??
        nodeVersions[0]?.value ??
        '';

    const [phpVersion, setPhpVersion] = useState(defaultPhp);
    const [nodeVersion, setNodeVersion] = useState(defaultNode);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [webDirectory, setWebDirectory] = useState('');
    const [spaFallback, setSpaFallback] = useState(true);
    const [repository, setRepository] = useState('');
    const [repositoryBranch, setRepositoryBranch] = useState('');
    const [githubRepoId, setGithubRepoId] = useState<number | null>(null);
    const [githubRepositories, setGithubRepositories] = useState<
        GitHubRepositoryOption[]
    >([]);
    const [repoLoading, setRepoLoading] = useState(false);
    const [branchLoading, setBranchLoading] = useState(false);
    const [branches, setBranches] = useState<string[]>([]);
    const [siteName, setSiteName] = useState('');
    const [databaseStrategy, setDatabaseStrategy] =
        useState<DatabaseStrategy>('create');
    const [databaseId, setDatabaseId] = useState('');
    const [databaseName, setDatabaseName] = useState('');

    const repositoryOptions = useMemo<SearchableComboboxOption[]>(
        () =>
            githubRepositories.map((repo) => ({
                value: repo.full_name,
                label: repo.full_name,
                description: repo.default_branch
                    ? `Default: ${repo.default_branch}`
                    : undefined,
            })),
        [githubRepositories],
    );

    const branchOptions = useMemo<SearchableComboboxOption[]>(
        () =>
            branches.map((branch) => ({
                value: branch,
                label: branch,
            })),
        [branches],
    );

    useEffect(() => {
        if (!createOpen || !github.connected) {
            return;
        }

        let cancelled = false;

        async function loadRepositories() {
            setRepoLoading(true);

            try {
                const response = await fetch(githubRepositoryRoute.url(), {
                    headers: { Accept: 'application/json' },
                });

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    repositories: GitHubRepositoryOption[];
                };

                setGithubRepositories(data.repositories);
            } finally {
                if (!cancelled) {
                    setRepoLoading(false);
                }
            }
        }

        void loadRepositories();

        return () => {
            cancelled = true;
        };
    }, [createOpen, github.connected]);

    useEffect(() => {
        const trimmed = repository.trim();

        if (!createOpen || trimmed === '') {
            setBranches([]);
            return;
        }

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            setBranchLoading(true);

            try {
                if (
                    github.connected &&
                    githubRepoId !== null &&
                    trimmed.includes('/')
                ) {
                    const [owner, repo] = trimmed.split('/');
                    const response = await fetch(
                        githubBranchRoute.url({ owner, repo }),
                        { headers: { Accept: 'application/json' } },
                    );

                    if (!response.ok || cancelled) {
                        return;
                    }

                    const data = (await response.json()) as {
                        branches: Array<{ name: string }>;
                    };

                    const names = data.branches.map((branch) => branch.name);
                    setBranches(names);

                    if (names.length > 0) {
                        setRepositoryBranch((current) => {
                            if (current && names.includes(current)) {
                                return current;
                            }

                            const selected = githubRepositories.find(
                                (entry) => entry.full_name === trimmed,
                            );

                            if (
                                selected?.default_branch &&
                                names.includes(selected.default_branch)
                            ) {
                                return selected.default_branch;
                            }

                            return names.includes('main')
                                ? 'main'
                                : names.includes('master')
                                  ? 'master'
                                  : names[0];
                        });
                    }

                    return;
                }

                const response = await fetch(
                    githubRemoteBranchRoute.url({
                        query: { repository: trimmed },
                    }),
                    { headers: { Accept: 'application/json' } },
                );

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    branches: Array<{ name: string }>;
                };

                const names = data.branches.map((branch) => branch.name);
                setBranches(names);

                if (names.length > 0) {
                    setRepositoryBranch((current) => {
                        if (current && names.includes(current)) {
                            return current;
                        }

                        return names.includes('main')
                            ? 'main'
                            : names.includes('master')
                              ? 'master'
                              : names[0];
                    });
                }
            } finally {
                if (!cancelled) {
                    setBranchLoading(false);
                }
            }
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [createOpen, github.connected, githubRepoId, repository]);

    function handleRepositoryChange(value: string) {
        setRepository(value);

        const selected = githubRepositories.find(
            (entry) => entry.full_name === value,
        );

        setGithubRepoId(selected?.id ?? null);

        if (selected?.default_branch) {
            setRepositoryBranch(selected.default_branch);
        } else {
            setRepositoryBranch('');
        }
    }

    function handleSiteNameChange(value: string) {
        setSiteName(value);

        if (databaseStrategy === 'create') {
            setDatabaseName(suggestDatabaseName(value));
        }
    }

    useEffect(() => {
        if (!createOpen) {
            return;
        }

        setSiteType('laravel');
        setSiteName('');
        setRepository('');
        setRepositoryBranch('');
        setGithubRepoId(null);
        setBranches([]);
        setAdvancedOpen(false);
        setWebDirectory('');
        setSpaFallback(true);
        setDatabaseStrategy('create');
        setDatabaseId('');
        setDatabaseName('');
        setPhpVersion(defaultPhp);
        setNodeVersion(defaultNode);
    }, [createOpen, defaultNode, defaultPhp]);

    // Reset the document root whenever the type changes so the placeholder
    // always reflects the default that type will actually get.
    const typeDefaultRoot = selected?.web_directory ?? '';
    const servesFromDisk = runtime === 'php' || runtime === 'none';

    // A runtime the site needs but the server does not have is a hard block,
    // not a validation error to discover after filling the whole form.
    const missingRuntime =
        (runtime === 'php' && phpVersions.length === 0) ||
        (runtime === 'node' && nodeVersions.length === 0);

    const stats = useMemo(() => sites.length, [sites]);

    const createSiteDialog = (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
                <Button variant="primary" size="sm">
                    <Plus />
                    New site
                </Button>
            </DialogTrigger>

            <DialogContent size="lg">
                <DialogHeader
                    tone="brand"
                    eyebrow="Provisioning"
                    icon={<Globe className="size-5" />}
                >
                    <DialogTitle>Create a site</DialogTitle>
                    <DialogDescription>
                        Beacon provisions the directory, Nginx vhost, and
                        runtime. Connect a Git repository now to deploy
                        immediately after creation.
                    </DialogDescription>
                </DialogHeader>

                <Form
                                    action={store()}
                                    onSuccess={() => setCreateOpen(false)}
                                    className="contents"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <DialogBody className="space-y-5">
                                            <DialogSection
                                                title="Site details"
                                                description="The domain becomes the site directory, Nginx vhost, and primary URL."
                                            >
                                                <div className="space-y-4">
                                                    <Field
                                                        htmlFor="name"
                                                        label="Domain"
                                                        required
                                                        error={errors.name}
                                                    >
                                                        <Input
                                                            id="name"
                                                            name="name"
                                                            mono
                                                            autoFocus
                                                            autoComplete="off"
                                                            spellCheck={false}
                                                            placeholder="app.example.com"
                                                            value={siteName}
                                                            onChange={(event) =>
                                                                handleSiteNameChange(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </Field>

                                                    <fieldset className="space-y-2">
                                                        <legend className="text-sm font-medium text-base-content">
                                                            Application type
                                                        </legend>

                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {siteTypes.map((type) => (
                                                                <label
                                                                    key={type.value}
                                                                    className={cn(
                                                                        'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors duration-[--bc-duration-fast]',
                                                                        siteType ===
                                                                            type.value
                                                                            ? 'border-border-brand bg-brand-subtle'
                                                                            : 'border-[var(--bc-border-default)] hover:border-border-hover',
                                                                    )}
                                                                >
                                                                    <SiteFrameworkIcon
                                                                        type={type.value}
                                                                        size="lg"
                                                                        className="mt-0.5"
                                                                    />
                                                                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                                        <span className="flex items-center gap-2">
                                                                            <input
                                                                                type="radio"
                                                                                name="type"
                                                                                value={
                                                                                    type.value
                                                                                }
                                                                                checked={
                                                                                    siteType ===
                                                                                    type.value
                                                                                }
                                                                                onChange={() => {
                                                                                    setSiteType(
                                                                                        type.value,
                                                                                    );

                                                                                    if (
                                                                                        type.value !==
                                                                                        'laravel'
                                                                                    ) {
                                                                                        setDatabaseStrategy(
                                                                                            'none',
                                                                                        );
                                                                                    } else if (
                                                                                        databaseStrategy ===
                                                                                        'none'
                                                                                    ) {
                                                                                        setDatabaseStrategy(
                                                                                            'create',
                                                                                        );
                                                                                        setDatabaseName(
                                                                                            suggestDatabaseName(
                                                                                                siteName,
                                                                                            ),
                                                                                        );
                                                                                    }
                                                                                }}
                                                                                className="size-3.5 accent-[var(--bc-bg-brand)]"
                                                                            />
                                                                            <span className="text-sm font-medium text-fg">
                                                                                {
                                                                                    type.label
                                                                                }
                                                                            </span>
                                                                        </span>
                                                                        <span className="text-[13px] leading-5 text-fg-muted">
                                                                            {
                                                                                type.description
                                                                            }
                                                                        </span>
                                                                    </span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <InputError
                                                            message={errors.type}
                                                        />
                                                    </fieldset>
                                                </div>
                                            </DialogSection>

                                            <DialogSection
                                                title="Git repository"
                                                description="Optional. Connect a repo now to deploy right after the site is created."
                                            >
                                                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                                                <Field
                                                    htmlFor="repository"
                                                    label="Git repository"
                                                    error={errors.repository}
                                                    help={
                                                        github.connected
                                                            ? 'Search your GitHub repositories or paste a URL.'
                                                            : 'HTTPS or SSH URL — e.g. git@github.com:org/app.git'
                                                    }
                                                >
                                                    {github.connected ? (
                                                        <>
                                                            <SearchableCombobox
                                                                id="repository"
                                                                name="repository"
                                                                value={repository}
                                                                onValueChange={
                                                                    handleRepositoryChange
                                                                }
                                                                options={
                                                                    repositoryOptions
                                                                }
                                                                loading={
                                                                    repoLoading
                                                                }
                                                                mono
                                                                placeholder="Search repositories…"
                                                            />
                                                            {githubRepoId !==
                                                                null && (
                                                                <>
                                                                    <input
                                                                        type="hidden"
                                                                        name="github_repo_id"
                                                                        value={
                                                                            githubRepoId
                                                                        }
                                                                    />
                                                                    <input
                                                                        type="hidden"
                                                                        name="github_repository"
                                                                        value={
                                                                            repository
                                                                        }
                                                                    />
                                                                </>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <Input
                                                            id="repository"
                                                            name="repository"
                                                            mono
                                                            autoComplete="off"
                                                            spellCheck={false}
                                                            placeholder="git@github.com:org/app.git"
                                                            value={repository}
                                                            onChange={(event) =>
                                                                setRepository(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    )}
                                                </Field>

                                                <Field
                                                    htmlFor="repository_branch"
                                                    label="Branch"
                                                    error={
                                                        errors.repository_branch
                                                    }
                                                    help={
                                                        branchLoading
                                                            ? 'Fetching branches…'
                                                            : branches.length >
                                                                0
                                                              ? `${branches.length} branches available`
                                                              : undefined
                                                    }
                                                >
                                                    {branches.length > 0 ? (
                                                        <SearchableCombobox
                                                            id="repository_branch"
                                                            name="repository_branch"
                                                            value={
                                                                repositoryBranch
                                                            }
                                                            onValueChange={
                                                                setRepositoryBranch
                                                            }
                                                            options={
                                                                branchOptions
                                                            }
                                                            loading={
                                                                branchLoading
                                                            }
                                                            mono
                                                            placeholder="Select branch"
                                                            disabled={
                                                                !repository.trim()
                                                            }
                                                        />
                                                    ) : (
                                                        <Input
                                                            id="repository_branch"
                                                            name="repository_branch"
                                                            mono
                                                            autoComplete="off"
                                                            spellCheck={false}
                                                            placeholder="main"
                                                            value={
                                                                repositoryBranch
                                                            }
                                                            onChange={(event) =>
                                                                setRepositoryBranch(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                            disabled={
                                                                !repository.trim()
                                                            }
                                                        />
                                                    )}
                                                </Field>
                                            </div>
                                            </DialogSection>

                                            {(runtime === 'php' ||
                                                runtime === 'node' ||
                                                runtime === 'none') && (
                                                <DialogSection
                                                    title="Runtime"
                                                    description={
                                                        runtime === 'php'
                                                            ? 'PHP-FPM pool, deploy script, and optional MySQL provisioning.'
                                                            : runtime === 'node'
                                                              ? 'Node version for the SSR process behind Nginx.'
                                                              : 'Static sites are served directly from disk.'
                                                    }
                                                >
                                                    <div className="space-y-4">
                                                        {runtime === 'php' && (
                                                            <Field
                                                                htmlFor="php_version"
                                                                label="PHP version"
                                                                required
                                                                error={
                                                                    errors.php_version
                                                                }
                                                                help="Only versions installed on this server are listed."
                                                            >
                                                                <Select
                                                                    value={
                                                                        phpVersion
                                                                    }
                                                                    onValueChange={
                                                                        setPhpVersion
                                                                    }
                                                                    name="php_version"
                                                                    disabled={
                                                                        phpVersions.length ===
                                                                        0
                                                                    }
                                                                >
                                                                    <SelectTrigger id="php_version">
                                                                        <SelectValue placeholder="Select a PHP version" />
                                                                    </SelectTrigger>
                                                                    <SelectContent portalled={false}>
                                                                        {phpVersions.map(
                                                                            (
                                                                                version,
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        version.value
                                                                                    }
                                                                                    value={
                                                                                        version.value
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        version.label
                                                                                    }
                                                                                    {version.is_default &&
                                                                                        ' · default'}
                                                                                </SelectItem>
                                                                            ),
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            </Field>
                                                        )}

                                                        {runtime === 'node' && (
                                                            <Field
                                                                htmlFor="node_version"
                                                                label="Node version"
                                                                required
                                                                error={
                                                                    errors.node_version
                                                                }
                                                                help="Runs the SSR server behind an Nginx reverse proxy."
                                                            >
                                                                <Select
                                                                    value={
                                                                        nodeVersion
                                                                    }
                                                                    onValueChange={
                                                                        setNodeVersion
                                                                    }
                                                                    name="node_version"
                                                                    disabled={
                                                                        nodeVersions.length ===
                                                                        0
                                                                    }
                                                                >
                                                                    <SelectTrigger id="node_version">
                                                                        <SelectValue placeholder="Select a Node version" />
                                                                    </SelectTrigger>
                                                                    <SelectContent portalled={false}>
                                                                        {nodeVersions.map(
                                                                            (
                                                                                version,
                                                                            ) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        version.value
                                                                                    }
                                                                                    value={
                                                                                        version.value
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        version.label
                                                                                    }
                                                                                    {version.is_default &&
                                                                                        ' · default'}
                                                                                </SelectItem>
                                                                            ),
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                            </Field>
                                                        )}

                                                        {runtime === 'none' && (
                                                            <p className="rounded-md border border-[var(--bc-border-default)] bg-[var(--bc-bg-subtle)] px-3 py-2.5 text-[13px] leading-5 text-fg-muted">
                                                                Static sites are
                                                                served straight
                                                                from disk. Nginx
                                                                will point at{' '}
                                                                <code className="font-mono text-fg-code">
                                                                    {selected?.web_directory ??
                                                                        '/'}
                                                                </code>{' '}
                                                                — no runtime
                                                                required.
                                                            </p>
                                                        )}

                                                        {runtime === 'php' && (
                                                            <div className="space-y-3 rounded-xl border border-base-300/80 bg-base-100/60 p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                                        <Database className="size-4" />
                                                                    </span>
                                                                    <div className="space-y-1">
                                                                        <p className="text-sm font-medium text-base-content">
                                                                            MySQL database
                                                                        </p>
                                                                        <p className="text-sm text-base-content/70">
                                                                            Beacon can create a database and user, then write the credentials into{' '}
                                                                            <code className="font-mono text-xs">.env</code>{' '}
                                                                            on the first deploy.
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <input
                                                                    type="hidden"
                                                                    name="database_strategy"
                                                                    value={
                                                                        databaseStrategy
                                                                    }
                                                                />

                                                                <div className="grid gap-2 sm:grid-cols-3">
                                                                    {(
                                                                        [
                                                                            {
                                                                                value: 'create',
                                                                                label: 'Create new',
                                                                                hint: 'Recommended',
                                                                            },
                                                                            {
                                                                                value: 'existing',
                                                                                label: 'Use existing',
                                                                                hint: 'Pick from server',
                                                                            },
                                                                            {
                                                                                value: 'none',
                                                                                label: 'None',
                                                                                hint: 'Configure later',
                                                                            },
                                                                        ] as const
                                                                    ).map(
                                                                        (
                                                                            option,
                                                                        ) => (
                                                                            <label
                                                                                key={
                                                                                    option.value
                                                                                }
                                                                                className={cn(
                                                                                    'cursor-pointer rounded-xl border px-3 py-2.5 transition-colors',
                                                                                    databaseStrategy ===
                                                                                        option.value
                                                                                        ? 'border-border-brand bg-brand-subtle'
                                                                                        : 'border-base-300 hover:border-border-hover',
                                                                                )}
                                                                            >
                                                                                <input
                                                                                    type="radio"
                                                                                    className="sr-only"
                                                                                    checked={
                                                                                        databaseStrategy ===
                                                                                        option.value
                                                                                    }
                                                                                    onChange={() => {
                                                                                        setDatabaseStrategy(
                                                                                            option.value,
                                                                                        );

                                                                                        if (
                                                                                            option.value ===
                                                                                            'create'
                                                                                        ) {
                                                                                            setDatabaseName(
                                                                                                suggestDatabaseName(
                                                                                                    siteName,
                                                                                                ),
                                                                                            );
                                                                                        }
                                                                                    }}
                                                                                />
                                                                                <span className="block text-sm font-medium text-base-content">
                                                                                    {
                                                                                        option.label
                                                                                    }
                                                                                </span>
                                                                                <span className="block text-xs text-base-content/60">
                                                                                    {
                                                                                        option.hint
                                                                                    }
                                                                                </span>
                                                                            </label>
                                                                        ),
                                                                    )}
                                                                </div>

                                                                <InputError
                                                                    message={
                                                                        errors.database_strategy
                                                                    }
                                                                />

                                                                {databaseStrategy ===
                                                                    'create' && (
                                                                    <Field
                                                                        htmlFor="database_name"
                                                                        label="Database name"
                                                                        required
                                                                        error={
                                                                            errors.database_name
                                                                        }
                                                                        help="Letters, numbers, and underscores only."
                                                                    >
                                                                        <Input
                                                                            id="database_name"
                                                                            name="database_name"
                                                                            mono
                                                                            autoComplete="off"
                                                                            spellCheck={
                                                                                false
                                                                            }
                                                                            placeholder="app_example_com"
                                                                            value={
                                                                                databaseName
                                                                            }
                                                                            onChange={(
                                                                                event,
                                                                            ) =>
                                                                                setDatabaseName(
                                                                                    event
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        />
                                                                    </Field>
                                                                )}

                                                                {databaseStrategy ===
                                                                    'existing' && (
                                                                    <Field
                                                                        htmlFor="database_id"
                                                                        label="Existing database"
                                                                        required
                                                                        error={
                                                                            errors.database_id
                                                                        }
                                                                        help={
                                                                            databases.length ===
                                                                            0
                                                                                ? 'No databases yet — create one from the Databases page or choose “Create new”.'
                                                                                : 'Beacon creates a dedicated user with full access to this database.'
                                                                        }
                                                                    >
                                                                        <Select
                                                                            value={
                                                                                databaseId
                                                                            }
                                                                            onValueChange={
                                                                                setDatabaseId
                                                                            }
                                                                            name="database_id"
                                                                            disabled={
                                                                                databases.length ===
                                                                                0
                                                                            }
                                                                        >
                                                                            <SelectTrigger id="database_id">
                                                                                <SelectValue placeholder="Select a database" />
                                                                            </SelectTrigger>
                                                                            <SelectContent portalled={false}>
                                                                                {databases.map(
                                                                                    (
                                                                                        database,
                                                                                    ) => (
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
                                                                    </Field>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogSection>
                                            )}

                                            <div className="rounded-xl border border-[var(--bc-border-default)]">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setAdvancedOpen(
                                                            !advancedOpen,
                                                        )
                                                    }
                                                    aria-expanded={advancedOpen}
                                                    className="flex w-full items-center gap-2 px-4 py-3 text-left"
                                                >
                                                    <ChevronRight
                                                        aria-hidden="true"
                                                        strokeWidth={1.5}
                                                        className={cn(
                                                            'size-4 text-fg-disabled transition-transform duration-[--bc-duration-base]',
                                                            advancedOpen &&
                                                                'rotate-90',
                                                        )}
                                                    />
                                                    <span className="text-[14px] leading-5 font-medium text-fg">
                                                        Advanced
                                                    </span>
                                                    <span className="text-caption ms-auto text-fg-subtle">
                                                        {servesFromDisk
                                                            ? `document root ${webDirectory || typeDefaultRoot}`
                                                            : 'upload limit, package manager'}
                                                    </span>
                                                </button>

                                                {advancedOpen && (
                                                    <div className="space-y-4 border-t border-[var(--bc-border-subtle)] px-3 py-4">
                                                        {servesFromDisk && (
                                                            <Field
                                                                htmlFor="web_directory"
                                                                label="Document root"
                                                                error={
                                                                    errors.web_directory
                                                                }
                                                                help={`Relative to ${'/home/beacon/<domain>'}. Leave blank for ${typeDefaultRoot}.`}
                                                            >
                                                                <Input
                                                                    id="web_directory"
                                                                    name="web_directory"
                                                                    mono
                                                                    autoComplete="off"
                                                                    spellCheck={
                                                                        false
                                                                    }
                                                                    placeholder={
                                                                        typeDefaultRoot
                                                                    }
                                                                    value={
                                                                        webDirectory
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setWebDirectory(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        )
                                                                    }
                                                                />
                                                            </Field>
                                                        )}

                                                        {servesFromDisk &&
                                                            (
                                                                WEB_DIRECTORY_PRESETS[
                                                                    siteType
                                                                ] ?? []
                                                            ).length > 1 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {(
                                                                        WEB_DIRECTORY_PRESETS[
                                                                            siteType
                                                                        ] ?? []
                                                                    ).map(
                                                                        (
                                                                            preset,
                                                                        ) => (
                                                                            <button
                                                                                key={
                                                                                    preset
                                                                                }
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setWebDirectory(
                                                                                        preset,
                                                                                    )
                                                                                }
                                                                                className={cn(
                                                                                    'rounded-sm border px-2 py-1 font-mono text-[12px] leading-[18px] transition-colors',
                                                                                    (webDirectory ||
                                                                                        typeDefaultRoot) ===
                                                                                        preset
                                                                                        ? 'border-border-brand bg-brand-subtle text-fg-brand'
                                                                                        : 'border-[var(--bc-border-default)] text-fg-muted hover:border-border-hover',
                                                                                )}
                                                                            >
                                                                                {
                                                                                    preset
                                                                                }
                                                                            </button>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            )}

                                                        {siteType ===
                                                            'static' && (
                                                            <label className="flex items-start gap-2.5">
                                                                <input
                                                                    type="checkbox"
                                                                    name="spa_fallback"
                                                                    value="1"
                                                                    checked={
                                                                        spaFallback
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setSpaFallback(
                                                                            event
                                                                                .target
                                                                                .checked,
                                                                        )
                                                                    }
                                                                    className="mt-1 size-3.5 accent-[var(--bc-bg-brand)]"
                                                                />
                                                                <span>
                                                                    <span className="block text-[14px] leading-5 font-medium text-fg">
                                                                        SPA
                                                                        fallback
                                                                    </span>
                                                                    <span className="block text-[13px] leading-5 text-fg-muted">
                                                                        Serve
                                                                        index.html
                                                                        for
                                                                        unknown
                                                                        paths.
                                                                        Required
                                                                        for
                                                                        React
                                                                        Router,
                                                                        Vue
                                                                        Router
                                                                        and
                                                                        similar.
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        )}

                                                        <Field
                                                            htmlFor="client_max_body_size"
                                                            label="Max upload size"
                                                            error={
                                                                errors.client_max_body_size
                                                            }
                                                            help="nginx client_max_body_size — e.g. 100M, 512k, 1G."
                                                        >
                                                            <Input
                                                                id="client_max_body_size"
                                                                name="client_max_body_size"
                                                                mono
                                                                autoComplete="off"
                                                                placeholder="100M"
                                                            />
                                                        </Field>

                                                        {runtime !== 'php' && (
                                                            <div className="flex flex-col gap-1.5">
                                                                <label
                                                                    htmlFor="package_manager"
                                                                    className="text-[14px] leading-5 font-medium text-fg"
                                                                >
                                                                    Package
                                                                    manager
                                                                </label>
                                                                <Select
                                                                    name="package_manager"
                                                                    defaultValue={
                                                                        packageManager
                                                                    }
                                                                >
                                                                    <SelectTrigger id="package_manager">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent portalled={false}>
                                                                        <SelectItem value="npm">
                                                                            npm
                                                                        </SelectItem>
                                                                        <SelectItem value="bun">
                                                                            bun
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {missingRuntime && (
                                                <p
                                                    role="alert"
                                                    className="rounded-md border border-[var(--bc-border-warning)] bg-warning-subtle px-3 py-2.5 text-[13px] leading-5 text-fg-warning"
                                                >
                                                    No{' '}
                                                    {runtime === 'php'
                                                        ? 'PHP'
                                                        : 'Node'}{' '}
                                                    runtime is installed on this
                                                    server yet. Install one
                                                    before creating this site
                                                    type.
                                                </p>
                                            )}

                                            </DialogBody>

                                            <DialogFooter>
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
                                                    disabled={
                                                        processing ||
                                                        missingRuntime
                                                    }
                                                >
                                                    {processing
                                                        ? 'Creating…'
                                                        : 'Create site'}
                                                </Button>
                                            </DialogFooter>
                                        </>
                                    )}
                                </Form>
                            </DialogContent>
        </Dialog>
    );

    return (
        <>
            <Head title="Sites" />

            {sites.length === 0 ? (
                <ForgePageLayout
                    main={
                        <ForgeEmptyState
                            icon={Globe}
                            title="No sites yet"
                            description="Create your first site and Beacon will provision the directory, the Nginx vhost and the runtime for you."
                        />
                    }
                    sidebar={
                        <>
                            <ForgeDetailsSection title="Sites">
                                <ForgeDetailRow label="Total" value="0" />
                                <ForgeDetailRow label="With Git" value="0" />
                                <ForgeDetailRow label="With TLS" value="0" />
                            </ForgeDetailsSection>
                            <ForgeActionsPanel>
                                {createSiteDialog}
                            </ForgeActionsPanel>
                        </>
                    }
                />
            ) : (
                <ForgePageLayout
                    main={
                        <ForgeDividedCard
                            title={`Sites (${stats})`}
                            action={createSiteDialog}
                        >
                            {sites.map((site) => (
                        <ForgeListRow key={site.id}>
                            <Link
                                href={show(site.name)}
                                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] dark:bg-[#2e3032]"
                            >
                                <SiteFrameworkIcon type={site.type} size="md" />
                            </Link>
                            <Link
                                href={show(site.name)}
                                className="min-w-0 flex-1"
                            >
                                <p className="truncate font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    {site.primary_domain || site.name}
                                </p>
                                {site.repository_connected && site.repository ? (
                                    <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-[#64748b]">
                                        <GitBranch className="size-3 shrink-0" />
                                        {site.repository}:{site.repository_branch}
                                    </p>
                                ) : (
                                    <p className="mt-0.5 text-xs text-[#64748b]">
                                        No repository connected
                                    </p>
                                )}
                            </Link>
                            <ForgeFrameworkBadge type={site.type} />
                            <ForgeStatusBadge
                                label={
                                    site.deployment_status === 'success'
                                        ? 'Deployed'
                                        : site.deployment_status
                                }
                                pulse={site.deployment_status === 'deploying'}
                            />
                        </ForgeListRow>
                            ))}
                        </ForgeDividedCard>
                    }
                    sidebar={
                        <ForgeDetailsSection title="Sites">
                            <ForgeDetailRow
                                label="Total"
                                value={String(sites.length)}
                            />
                            <ForgeDetailRow
                                label="With Git"
                                value={String(
                                    sites.filter((s) => s.repository_connected)
                                        .length,
                                )}
                            />
                            <ForgeDetailRow
                                label="With TLS"
                                value={String(
                                    sites.filter(
                                        (s) =>
                                            s.ssl_status === 'active' ||
                                            s.ssl_status === 'issued',
                                    ).length,
                                )}
                            />
                        </ForgeDetailsSection>
                    }
                />
            )}
        </>
    );
}

SitesIndex.layout = {
    breadcrumbs: [{ title: 'Sites', href: sitesIndex() }],
};
