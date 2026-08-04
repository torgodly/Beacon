import { Form } from '@inertiajs/react';
import { ChevronRight, Globe, Plus, Zap } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ForgeFormRows } from '@/components/forge/forge-form-row';
import InputError from '@/components/input-error';
import {
    CreateSiteLaravelStack,
    suggestDatabaseName,
} from '@/components/sites/create-site-laravel-stack';
import {
    CreateSiteStepper,
    type CreateSiteStep,
} from '@/components/sites/create-site-stepper';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import {
    SearchableCombobox,
    type SearchableComboboxOption,
} from '@/components/searchable-combobox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogBody,
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
import { cn } from '@/lib/utils';
import {
    bodySizeError,
    branchError,
    databaseNameError,
    hostnameError,
    normalizeHostname,
    repositoryError,
    webDirectoryError,
    type FieldErrors,
} from '@/lib/validation';
import {
    branches as githubBranchRoute,
    remoteBranches as githubRemoteBranchRoute,
    repositories as githubRepositoryRoute,
} from '@/routes/github';
import { store } from '@/routes/sites';

type GitHubRepositoryOption = {
    id: number;
    full_name: string;
    clone_url: string;
    ssh_url: string;
    default_branch: string | null;
};

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
type AppEnv = 'testing' | 'staging' | 'production';
type DatabaseDriver = 'mysql' | 'sqlite';

const WEB_DIRECTORY_PRESETS: Record<string, string[]> = {
    laravel: ['/public'],
    static: ['/', '/dist', '/build', '/out', '/public'],
    nextjs: [],
    nuxt: [],
};

type CreateSiteDialogProps = {
    trigger?: ReactNode;
    siteTypes: SiteTypeOption[];
    phpVersions: RuntimeOption[];
    nodeVersions: RuntimeOption[];
    packageManager: string;
    github: { connected: boolean };
    databases: DatabaseOption[];
};

export function CreateSiteDialog({
    trigger,
    siteTypes,
    phpVersions,
    nodeVersions,
    packageManager,
    github,
    databases,
}: CreateSiteDialogProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<CreateSiteStep>('site');
    const [siteType, setSiteType] = useState('laravel');

    const defaultPhp =
        phpVersions.find((version) => version.is_default)?.value ??
        phpVersions[0]?.value ??
        '';
    const defaultNode =
        nodeVersions.find((version) => version.is_default)?.value ??
        nodeVersions[0]?.value ??
        '';

    const selected = siteTypes.find((type) => type.value === siteType);
    const runtime = selected?.runtime ?? 'none';
    const typeDefaultRoot = selected?.web_directory ?? '';
    const servesFromDisk = runtime === 'php' || runtime === 'none';
    const missingRuntime =
        (runtime === 'php' && phpVersions.length === 0) ||
        (runtime === 'node' && nodeVersions.length === 0);

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
    const [appEnv, setAppEnv] = useState<AppEnv>('production');
    const [databaseDriver, setDatabaseDriver] =
        useState<DatabaseDriver>('mysql');
    const [redisEnabled, setRedisEnabled] = useState(false);
    const [autoDeploy, setAutoDeploy] = useState(false);
    const [clientMaxBodySize, setClientMaxBodySize] = useState('');
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

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

    function resetForm(): void {
        setStep('site');
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
        setAppEnv('production');
        setDatabaseDriver('mysql');
        setRedisEnabled(false);
        setAutoDeploy(false);
        setClientMaxBodySize('');
        setFieldErrors({});
        setPhpVersion(defaultPhp);
        setNodeVersion(defaultNode);
    }

    function clearFieldError(field: string): void {
        setFieldErrors((current) => {
            if (!(field in current)) {
                return current;
            }

            const next = { ...current };
            delete next[field];
            return next;
        });
    }

    function validateSiteStep(): boolean {
        const nameError = hostnameError(siteName);
        const nextErrors: FieldErrors = {};

        if (nameError) {
            nextErrors.name = nameError;
        }

        setFieldErrors(nextErrors);

        return !nameError;
    }

    function validateGitStep(): boolean {
        const nextErrors: FieldErrors = {};
        const repoError = repositoryError(repository);
        const branchErr = branchError(repositoryBranch, repository);

        if (repoError) {
            nextErrors.repository = repoError;
        }

        if (branchErr) {
            nextErrors.repository_branch = branchErr;
        }

        setFieldErrors(nextErrors);

        return !repoError && !branchErr;
    }

    function validateConfigureStep(): boolean {
        const nextErrors: FieldErrors = {};

        if (runtime === 'php' && !phpVersion) {
            nextErrors.php_version = 'Select a PHP version.';
        }

        if (runtime === 'node' && !nodeVersion) {
            nextErrors.node_version = 'Select a Node version.';
        }

        if (siteType === 'laravel' && databaseDriver === 'mysql') {
            if (databaseStrategy === 'create') {
                const dbNameError = databaseNameError(databaseName);

                if (dbNameError) {
                    nextErrors.database_name = dbNameError;
                }
            } else if (databaseStrategy === 'existing' && !databaseId) {
                nextErrors.database_id =
                    'Select an existing database or choose to create a new one.';
            }
        }

        const webDirError = webDirectoryError(webDirectory);

        if (webDirError) {
            nextErrors.web_directory = webDirError;
        }

        const bodyError = bodySizeError(clientMaxBodySize);

        if (bodyError) {
            nextErrors.client_max_body_size = bodyError;
        }

        setFieldErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    }

    function resolveStepForServerErrors(errors: Record<string, string>): CreateSiteStep {
        if (errors.name || errors.type) {
            return 'site';
        }

        if (errors.repository || errors.repository_branch) {
            return 'git';
        }

        return 'configure';
    }

    useEffect(() => {
        if (!open) {
            return;
        }

        resetForm();
    }, [open, defaultNode, defaultPhp]);

    useEffect(() => {
        if (!open || !github.connected) {
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
    }, [open, github.connected]);

    useEffect(() => {
        const trimmed = repository.trim();

        if (!open || trimmed === '') {
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

                            const selectedRepo = githubRepositories.find(
                                (entry) => entry.full_name === trimmed,
                            );

                            if (
                                selectedRepo?.default_branch &&
                                names.includes(selectedRepo.default_branch)
                            ) {
                                return selectedRepo.default_branch;
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
    }, [open, github.connected, githubRepoId, repository, githubRepositories]);

    function handleRepositoryChange(value: string): void {
        setRepository(value);
        clearFieldError('repository');
        clearFieldError('repository_branch');

        const selectedRepo = githubRepositories.find(
            (entry) => entry.full_name === value,
        );

        setGithubRepoId(selectedRepo?.id ?? null);

        if (selectedRepo?.id) {
            setAutoDeploy(true);
        } else if (!value.trim()) {
            setAutoDeploy(false);
        }

        if (selectedRepo?.default_branch) {
            setRepositoryBranch(selectedRepo.default_branch);
        } else {
            setRepositoryBranch('');
        }
    }

    function handleSiteNameChange(value: string): void {
        const normalized = normalizeHostname(value);
        setSiteName(normalized);
        clearFieldError('name');

        if (databaseStrategy === 'create') {
            setDatabaseName(suggestDatabaseName(normalized));
        }
    }

    function handleSiteTypeChange(value: string): void {
        setSiteType(value);

        if (value !== 'laravel') {
            setDatabaseStrategy('none');
        } else if (databaseStrategy === 'none') {
            setDatabaseStrategy('create');
            setDatabaseName(suggestDatabaseName(siteName));
        }
    }

    function canContinue(): boolean {
        if (step === 'site') {
            return hostnameError(siteName) === undefined;
        }

        if (step === 'git') {
            return (
                repositoryError(repository) === undefined &&
                branchError(repositoryBranch, repository) === undefined
            );
        }

        return true;
    }

    function goNext(): void {
        if (step === 'site') {
            if (!validateSiteStep()) {
                return;
            }

            setStep('git');
            return;
        }

        if (step === 'git') {
            if (!validateGitStep()) {
                return;
            }

            setStep('configure');
        }
    }

    function goBack(): void {
        if (step === 'configure') {
            setStep('git');
        } else if (step === 'git') {
            setStep('site');
        }
    }

    const stepDescription = {
        site: 'Choose the domain and application type for this site.',
        git: 'Connect a repository now, or skip and add one later.',
        configure: 'Set the runtime and environment Beacon writes into .env on deploy.',
    }[step];

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (!next) {
                    resetForm();
                }
            }}
        >
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="primary" size="sm">
                        <Plus />
                        New site
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent size="lg">
                <Form
                    action={store()}
                    onSuccess={() => {
                        setOpen(false);
                        resetForm();
                    }}
                    onError={(errors) => {
                        setStep(resolveStepForServerErrors(errors));
                        setFieldErrors({});
                    }}
                    onSubmit={(event) => {
                        if (step !== 'configure') {
                            event.preventDefault();

                            if (step === 'site' && validateSiteStep()) {
                                setStep('git');
                            } else if (step === 'git' && validateGitStep()) {
                                setStep('configure');
                            }

                            return;
                        }

                        if (!validateConfigureStep()) {
                            event.preventDefault();
                        }
                    }}
                    className="flex min-h-0 flex-1 flex-col"
                >
                    {({ processing, errors }) => (
                        <>
                            <DialogHeader
                                tone="brand"
                                eyebrow="Create site"
                                icon={<Globe className="size-5" />}
                            >
                                <DialogTitle>Provision a new site</DialogTitle>
                                <DialogDescription>
                                    {stepDescription}
                                </DialogDescription>
                            </DialogHeader>

                            <CreateSiteStepper step={step} />

                            <DialogBody className="space-y-5 overflow-visible">
                                {step === 'site' && (
                                    <div className="space-y-5">
                                        <Field
                                            htmlFor="name"
                                            label="Domain"
                                            required
                                            error={
                                                fieldErrors.name ?? errors.name
                                            }
                                            help="Becomes the site directory, Nginx vhost, and primary URL."
                                        >
                                            <Input
                                                id="name"
                                                mono
                                                autoFocus
                                                autoComplete="off"
                                                spellCheck={false}
                                                placeholder="app.example.com"
                                                value={siteName}
                                                aria-invalid={
                                                    Boolean(
                                                        fieldErrors.name ??
                                                            errors.name,
                                                    ) || undefined
                                                }
                                                onChange={(event) =>
                                                    handleSiteNameChange(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </Field>

                                        <fieldset className="space-y-3">
                                            <legend className="text-sm font-medium text-base-content">
                                                Application type
                                            </legend>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {siteTypes.map((type) => (
                                                    <label
                                                        key={type.value}
                                                        className={cn(
                                                            'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
                                                            siteType ===
                                                                type.value
                                                                ? 'border-border-brand bg-brand-subtle'
                                                                : 'border-base-300 hover:border-border-hover',
                                                        )}
                                                    >
                                                        <SiteFrameworkIcon
                                                            type={type.value}
                                                            size="lg"
                                                            className="mt-0.5 shrink-0"
                                                        />
                                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                                            <span className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    value={
                                                                        type.value
                                                                    }
                                                                    checked={
                                                                        siteType ===
                                                                        type.value
                                                                    }
                                                                    onChange={() =>
                                                                        handleSiteTypeChange(
                                                                            type.value,
                                                                        )
                                                                    }
                                                                    className="size-3.5 accent-[var(--bc-bg-brand)]"
                                                                />
                                                                <span className="text-sm font-medium text-base-content">
                                                                    {
                                                                        type.label
                                                                    }
                                                                </span>
                                                            </span>
                                                            <span className="text-[13px] leading-5 text-base-content/70">
                                                                {
                                                                    type.description
                                                                }
                                                            </span>
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <InputError message={errors.type} />
                                        </fieldset>
                                    </div>
                                )}

                                {step === 'git' && (
                                    <div className="space-y-5">
                                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                                            <Field
                                                htmlFor="repository"
                                                label="Git repository"
                                                error={
                                                    fieldErrors.repository ??
                                                    errors.repository
                                                }
                                                help={
                                                    github.connected
                                                        ? 'Search GitHub or paste a URL. Leave empty to skip.'
                                                        : 'HTTPS or SSH URL — leave empty to skip.'
                                                }
                                            >
                                                {github.connected ? (
                                                    <>
                                                        <SearchableCombobox
                                                            id="repository"
                                                            value={repository}
                                                            portalled
                                                            onValueChange={
                                                                handleRepositoryChange
                                                            }
                                                            options={
                                                                repositoryOptions
                                                            }
                                                            loading={repoLoading}
                                                            mono
                                                            placeholder="Search repositories…"
                                                        />
                                                        {githubRepoId !==
                                                            null && (
                                                            <p className="text-xs text-base-content/60">
                                                                Linked to GitHub
                                                                repository #
                                                                {githubRepoId}
                                                            </p>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Input
                                                        id="repository"
                                                        mono
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        placeholder="git@github.com:org/app.git"
                                                        value={repository}
                                                        onChange={(event) => {
                                                            setRepository(
                                                                event.target
                                                                    .value,
                                                            );
                                                            clearFieldError(
                                                                'repository',
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </Field>

                                            <Field
                                                htmlFor="repository_branch"
                                                label="Branch"
                                                error={
                                                    fieldErrors.repository_branch ??
                                                    errors.repository_branch
                                                }
                                                help={
                                                    branchLoading
                                                        ? 'Fetching branches…'
                                                        : branches.length > 0
                                                          ? `${branches.length} branches`
                                                          : 'Defaults to main'
                                                }
                                            >
                                                {branches.length > 0 ? (
                                                    <SearchableCombobox
                                                        id="repository_branch"
                                                        value={repositoryBranch}
                                                        portalled
                                                        onValueChange={(
                                                            value,
                                                        ) => {
                                                            setRepositoryBranch(
                                                                value,
                                                            );
                                                            clearFieldError(
                                                                'repository_branch',
                                                            );
                                                        }}
                                                        options={branchOptions}
                                                        loading={branchLoading}
                                                        mono
                                                        placeholder="Select branch"
                                                        disabled={
                                                            !repository.trim()
                                                        }
                                                    />
                                                ) : (
                                                    <Input
                                                        id="repository_branch"
                                                        mono
                                                        autoComplete="off"
                                                        spellCheck={false}
                                                        placeholder="main"
                                                        value={repositoryBranch}
                                                        onChange={(event) => {
                                                            setRepositoryBranch(
                                                                event.target
                                                                    .value,
                                                            );
                                                            clearFieldError(
                                                                'repository_branch',
                                                            );
                                                        }}
                                                        disabled={
                                                            !repository.trim()
                                                        }
                                                    />
                                                )}
                                            </Field>
                                        </div>

                                        {repository.trim() ? (
                                            <ForgeFormRows>
                                                <div className="flex items-start gap-3 px-4 py-3">
                                                    <Checkbox
                                                        id="auto_deploy"
                                                        checked={autoDeploy}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            setAutoDeploy(
                                                                checked === true,
                                                            )
                                                        }
                                                        className="mt-0.5"
                                                    />
                                                    <label
                                                        htmlFor="auto_deploy"
                                                        className="min-w-0 space-y-1"
                                                    >
                                                        <span className="flex items-center gap-2 text-sm font-medium text-base-content">
                                                            <Zap className="size-4 text-primary" />
                                                            Auto deploy
                                                        </span>
                                                        <span className="block text-[13px] leading-5 text-base-content/70">
                                                            Deploy when{' '}
                                                            <code className="font-mono text-xs">
                                                                {repositoryBranch ||
                                                                    'main'}
                                                            </code>{' '}
                                                            changes on the remote.
                                                        </span>
                                                    </label>
                                                </div>
                                            </ForgeFormRows>
                                        ) : (
                                            <p className="rounded-xl border border-dashed border-base-300 bg-base-200/30 px-4 py-3 text-sm text-base-content/70">
                                                No repository connected yet. You
                                                can add one later from the site
                                                settings page.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {step === 'configure' && (
                                    <div className="space-y-5">
                                        {runtime === 'php' && (
                                            <Field
                                                htmlFor="php_version"
                                                label="PHP version"
                                                required
                                                error={
                                                    fieldErrors.php_version ??
                                                    errors.php_version
                                                }
                                            >
                                                <Select
                                                    value={phpVersion}
                                                    onValueChange={setPhpVersion}
                                                    disabled={
                                                        phpVersions.length === 0
                                                    }
                                                >
                                                    <SelectTrigger id="php_version">
                                                        <SelectValue placeholder="Select PHP version" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {phpVersions.map(
                                                            (version) => (
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
                                                    fieldErrors.node_version ??
                                                    errors.node_version
                                                }
                                            >
                                                <Select
                                                    value={nodeVersion}
                                                    onValueChange={setNodeVersion}
                                                    disabled={
                                                        nodeVersions.length ===
                                                        0
                                                    }
                                                >
                                                    <SelectTrigger id="node_version">
                                                        <SelectValue placeholder="Select Node version" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {nodeVersions.map(
                                                            (version) => (
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
                                            <p className="rounded-xl border border-base-300 bg-base-200/30 px-4 py-3 text-sm text-base-content/70">
                                                Static sites are served from{' '}
                                                <code className="font-mono text-xs">
                                                    {typeDefaultRoot}
                                                </code>{' '}
                                                with no runtime process.
                                            </p>
                                        )}

                                        {runtime === 'php' && (
                                            <CreateSiteLaravelStack
                                                appEnv={appEnv}
                                                setAppEnv={setAppEnv}
                                                databaseDriver={databaseDriver}
                                                setDatabaseDriver={
                                                    setDatabaseDriver
                                                }
                                                databaseStrategy={
                                                    databaseStrategy
                                                }
                                                setDatabaseStrategy={
                                                    setDatabaseStrategy
                                                }
                                                databaseId={databaseId}
                                                setDatabaseId={setDatabaseId}
                                                databaseName={databaseName}
                                                setDatabaseName={setDatabaseName}
                                                redisEnabled={redisEnabled}
                                                setRedisEnabled={setRedisEnabled}
                                                siteName={siteName}
                                                databases={databases}
                                                errors={{
                                                    ...errors,
                                                    ...fieldErrors,
                                                }}
                                            />
                                        )}

                                        <div className="rounded-xl border border-base-300">
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
                                                    className={cn(
                                                        'size-4 text-base-content/50 transition-transform',
                                                        advancedOpen &&
                                                            'rotate-90',
                                                    )}
                                                />
                                                <span className="text-sm font-medium text-base-content">
                                                    Advanced options
                                                </span>
                                                <span className="ms-auto text-xs text-base-content/50">
                                                    Optional
                                                </span>
                                            </button>

                                            {advancedOpen && (
                                                <div className="space-y-4 border-t border-base-300 px-4 py-4">
                                                    {servesFromDisk && (
                                                        <Field
                                                            htmlFor="web_directory"
                                                            label="Document root"
                                                            error={
                                                                fieldErrors.web_directory ??
                                                                errors.web_directory
                                                            }
                                                            help={`Leave blank for ${typeDefaultRoot}.`}
                                                        >
                                                            <Input
                                                                id="web_directory"
                                                                mono
                                                                autoComplete="off"
                                                                placeholder={
                                                                    typeDefaultRoot
                                                                }
                                                                value={
                                                                    webDirectory
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) => {
                                                                    setWebDirectory(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    );
                                                                    clearFieldError(
                                                                        'web_directory',
                                                                    );
                                                                }}
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
                                                                {WEB_DIRECTORY_PRESETS[
                                                                    siteType
                                                                ].map(
                                                                    (preset) => (
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
                                                                                'rounded-md border px-2 py-1 font-mono text-xs transition-colors',
                                                                                (webDirectory ||
                                                                                    typeDefaultRoot) ===
                                                                                    preset
                                                                                    ? 'border-border-brand bg-brand-subtle text-fg-brand'
                                                                                    : 'border-base-300 text-base-content/70 hover:border-border-hover',
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

                                                    {siteType === 'static' && (
                                                        <label className="flex items-start gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                id="spa_fallback"
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
                                                            <span className="text-sm text-base-content/80">
                                                                SPA fallback for
                                                                client-side
                                                                routers
                                                            </span>
                                                        </label>
                                                    )}

                                                    <Field
                                                        htmlFor="client_max_body_size"
                                                        label="Max upload size"
                                                        error={
                                                            fieldErrors.client_max_body_size ??
                                                            errors.client_max_body_size
                                                        }
                                                    >
                                                        <Input
                                                            id="client_max_body_size"
                                                            mono
                                                            autoComplete="off"
                                                            placeholder="100M"
                                                            value={
                                                                clientMaxBodySize
                                                            }
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                setClientMaxBodySize(
                                                                    event.target
                                                                        .value,
                                                                );
                                                                clearFieldError(
                                                                    'client_max_body_size',
                                                                );
                                                            }}
                                                        />
                                                    </Field>

                                                    {runtime !== 'php' && (
                                                        <Field
                                                            htmlFor="package_manager"
                                                            label="Package manager"
                                                        >
                                                            <Select
                                                                defaultValue={
                                                                    packageManager
                                                                }
                                                            >
                                                                <SelectTrigger id="package_manager">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="npm">
                                                                        npm
                                                                    </SelectItem>
                                                                    <SelectItem value="bun">
                                                                        bun
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </Field>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {missingRuntime && (
                                            <p
                                                role="alert"
                                                className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
                                            >
                                                Install a{' '}
                                                {runtime === 'php'
                                                    ? 'PHP'
                                                    : 'Node'}{' '}
                                                runtime on this server before
                                                creating this site type.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </DialogBody>

                            <div className="sr-only" aria-hidden="true">
                                <input
                                    type="hidden"
                                    name="name"
                                    value={siteName}
                                />
                                <input
                                    type="hidden"
                                    name="type"
                                    value={siteType}
                                />
                                <input
                                    type="hidden"
                                    name="repository"
                                    value={repository}
                                />
                                <input
                                    type="hidden"
                                    name="repository_branch"
                                    value={repositoryBranch}
                                />
                                {githubRepoId !== null && (
                                    <>
                                        <input
                                            type="hidden"
                                            name="github_repo_id"
                                            value={githubRepoId}
                                        />
                                        <input
                                            type="hidden"
                                            name="github_repository"
                                            value={repository}
                                        />
                                    </>
                                )}
                                <input
                                    type="hidden"
                                    name="auto_deploy"
                                    value={autoDeploy ? '1' : '0'}
                                />
                                {runtime === 'php' && (
                                    <input
                                        type="hidden"
                                        name="php_version"
                                        value={phpVersion}
                                    />
                                )}
                                {runtime === 'node' && (
                                    <input
                                        type="hidden"
                                        name="node_version"
                                        value={nodeVersion}
                                    />
                                )}
                                {siteType === 'laravel' && (
                                    <>
                                        <input
                                            type="hidden"
                                            name="app_env"
                                            value={appEnv}
                                        />
                                        <input
                                            type="hidden"
                                            name="database_driver"
                                            value={databaseDriver}
                                        />
                                        <input
                                            type="hidden"
                                            name="database_strategy"
                                            value={databaseStrategy}
                                        />
                                        <input
                                            type="hidden"
                                            name="redis_enabled"
                                            value={redisEnabled ? '1' : '0'}
                                        />
                                        {databaseStrategy === 'create' && (
                                            <input
                                                type="hidden"
                                                name="database_name"
                                                value={databaseName}
                                            />
                                        )}
                                        {databaseStrategy === 'existing' && (
                                            <input
                                                type="hidden"
                                                name="database_id"
                                                value={databaseId}
                                            />
                                        )}
                                    </>
                                )}
                                {servesFromDisk && (
                                    <>
                                        <input
                                            type="hidden"
                                            name="web_directory"
                                            value={webDirectory}
                                        />
                                        {siteType === 'static' && (
                                            <input
                                                type="hidden"
                                                name="spa_fallback"
                                                value={spaFallback ? '1' : '0'}
                                            />
                                        )}
                                    </>
                                )}
                                <input
                                    type="hidden"
                                    name="client_max_body_size"
                                    value={clientMaxBodySize}
                                />
                                {runtime !== 'php' && (
                                    <input
                                        type="hidden"
                                        name="package_manager"
                                        value={packageManager}
                                    />
                                )}
                            </div>

                            <DialogFooter className="justify-between sm:justify-between">
                                <div>
                                    {step !== 'site' ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={goBack}
                                        >
                                            Back
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            onClick={() => setOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {step !== 'configure' ? (
                                        <Button
                                            type="button"
                                            variant="primary"
                                            disabled={!canContinue()}
                                            onClick={goNext}
                                        >
                                            Continue
                                        </Button>
                                    ) : (
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            disabled={
                                                processing || missingRuntime
                                            }
                                        >
                                            {processing
                                                ? 'Creating…'
                                                : 'Create site'}
                                        </Button>
                                    )}
                                </div>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
