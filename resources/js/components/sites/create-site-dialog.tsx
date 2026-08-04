import { router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Database as DatabaseIcon,
    FolderTree,
    GitBranch,
    Globe,
    Plus,
    Rocket,
    Server as ServerIcon,
    SlidersHorizontal,
    Terminal,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {ReactNode} from 'react';
import {
    SearchableCombobox
    
} from '@/components/searchable-combobox';
import type {SearchableComboboxOption} from '@/components/searchable-combobox';
import {
    CreateSiteLaravelStack,
    suggestDatabaseName,
} from '@/components/sites/create-site-laravel-stack';
import {
    CREATE_SITE_STEPS,
    CreateSiteSteps,
    stepIndex
    
} from '@/components/sites/create-site-steps';
import type {CreateSiteStep} from '@/components/sites/create-site-steps';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import { Button } from '@/components/ui/button';
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
import {
    ChoiceCard,
    ChoiceCardGroup,
    Field,
    FormDivider,
    FormGrid,
    FormSection,
    SummaryRow,
    ToggleRow,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
    webDirectoryError
    
} from '@/lib/validation';
import type {FieldErrors} from '@/lib/validation';
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

/**
 * How long the final "Create site" button stays inert after the review step
 * appears.
 *
 * "Continue" and "Create site" sit in the same corner of the footer, which is
 * the conventional place for them. That previously meant a double-click on
 * Continue provisioned a site and a database on the second press, because the
 * button under the cursor had changed identity between the two clicks. A brief
 * arming delay absorbs the stray press. It is short enough to be invisible to
 * anyone who actually read the summary.
 */
const CREATE_ARM_DELAY_MS = 450;

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
    const [processing, setProcessing] = useState(false);
    const [armed, setArmed] = useState(false);

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
            branches.map((branch) => ({ value: branch, label: branch })),
        [branches],
    );

    const resolvedRoot = webDirectory.trim() || typeDefaultRoot || '/';

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
        setProcessing(false);
        setArmed(false);
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
        setFieldErrors(nameError ? { name: nameError } : {});

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

    function resolveStepForServerErrors(
        errors: Record<string, string>,
    ): CreateSiteStep {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defaultNode, defaultPhp]);

    // Arm the create button only once the review step has been on screen long
    // enough that a click cannot be left over from the press that got here.
    //
    // Disarming happens in navigate(), not here — setting state synchronously
    // in an effect body causes a cascading render, and the state is already
    // known at the moment the step changes.
    useEffect(() => {
        if (step !== 'review') {
            return;
        }

        const timer = window.setTimeout(
            () => setArmed(true),
            CREATE_ARM_DELAY_MS,
        );

        return () => window.clearTimeout(timer);
    }, [step]);

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

        setRepositoryBranch(selectedRepo?.default_branch ?? '');
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

    function validateStep(target: CreateSiteStep): boolean {
        if (target === 'site') {
return validateSiteStep();
}

        if (target === 'git') {
return validateGitStep();
}

        if (target === 'configure') {
return validateConfigureStep();
}

        return true;
    }

    /** Single entry point for step changes, so arming state can never drift. */
    function navigate(target: CreateSiteStep): void {
        setArmed(false);
        setStep(target);
    }

    function goNext(): void {
        if (!validateStep(step)) {
            return;
        }

        const next = CREATE_SITE_STEPS[stepIndex(step) + 1];

        if (next) {
            navigate(next.id);
        }
    }

    function goBack(): void {
        const previous = CREATE_SITE_STEPS[stepIndex(step) - 1];

        if (previous) {
            setFieldErrors({});
            navigate(previous.id);
        }
    }

    /**
     * The only place a site is created.
     *
     * The wizard deliberately renders no <form>. Submission cannot be reached
     * by the Enter key, by a button that forgot type="button", or by anything
     * other than this handler — which is wired to exactly one control, on the
     * review step, after the arming delay.
     */
    function handleCreate(): void {
        if (processing || !armed || missingRuntime) {
            return;
        }

        if (!validateSiteStep()) {
            navigate('site');

            return;
        }

        if (!validateConfigureStep()) {
            navigate('configure');

            return;
        }

        const payload: Record<string, string | number | boolean> = {
            name: siteName,
            type: siteType,
            repository,
            repository_branch: repositoryBranch,
            auto_deploy: autoDeploy,
            client_max_body_size: clientMaxBodySize,
        };

        if (githubRepoId !== null) {
            payload.github_repo_id = githubRepoId;
            payload.github_repository = repository;
        }

        if (runtime === 'php') {
            payload.php_version = phpVersion;
        }

        if (runtime === 'node') {
            payload.node_version = nodeVersion;
        }

        if (runtime !== 'php') {
            payload.package_manager = packageManager;
        }

        if (siteType === 'laravel') {
            payload.app_env = appEnv;
            payload.database_driver = databaseDriver;
            payload.database_strategy = databaseStrategy;
            payload.redis_enabled = redisEnabled;

            if (databaseStrategy === 'create') {
                payload.database_name = databaseName;
            }

            if (databaseStrategy === 'existing') {
                payload.database_id = databaseId;
            }
        }

        if (servesFromDisk) {
            payload.web_directory = webDirectory;

            if (siteType === 'static') {
                payload.spa_fallback = spaFallback;
            }
        }

        router.post(store().url, payload, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setOpen(false);
                resetForm();
            },
            onError: (errors) => {
                // Feed the server's messages into the same map the Field
                // components read. Without this the request is rejected, the
                // wizard jumps back a step, and nothing explains why — which
                // is worse than no validation at all.
                navigate(resolveStepForServerErrors(errors));
                setFieldErrors(errors as FieldErrors);
            },
        });
    }

    const isReview = step === 'review';

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

            <DialogContent size="xl">
                <div className="flex min-h-0 flex-1 flex-col">
                    <DialogHeader
                        tone="brand"
                        eyebrow="Create site"
                        icon={<Globe className="size-5" />}
                    >
                        <DialogTitle>Provision a new site</DialogTitle>
                        <DialogDescription>
                            {
                                CREATE_SITE_STEPS[stepIndex(step)]
                                    ?.caption
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <CreateSiteSteps step={step} onNavigate={navigate} />

                    <DialogBody className="flex flex-col gap-6">
                        {step === 'site' && (
                            <SiteStep
                                siteTypes={siteTypes}
                                siteType={siteType}
                                onSiteTypeChange={handleSiteTypeChange}
                                siteName={siteName}
                                onSiteNameChange={handleSiteNameChange}
                                error={fieldErrors.name}
                            />
                        )}

                        {step === 'git' && (
                            <GitStep
                                github={github}
                                repository={repository}
                                onRepositoryChange={handleRepositoryChange}
                                repositoryOptions={repositoryOptions}
                                repoLoading={repoLoading}
                                repositoryBranch={repositoryBranch}
                                onBranchChange={(value) => {
                                    setRepositoryBranch(value);
                                    clearFieldError('repository_branch');
                                }}
                                branchOptions={branchOptions}
                                branchLoading={branchLoading}
                                autoDeploy={autoDeploy}
                                onAutoDeployChange={setAutoDeploy}
                                errors={fieldErrors}
                            />
                        )}

                        {step === 'configure' && (
                            <ConfigureStep
                                siteType={siteType}
                                runtime={runtime}
                                missingRuntime={missingRuntime}
                                phpVersions={phpVersions}
                                phpVersion={phpVersion}
                                setPhpVersion={setPhpVersion}
                                nodeVersions={nodeVersions}
                                nodeVersion={nodeVersion}
                                setNodeVersion={setNodeVersion}
                                servesFromDisk={servesFromDisk}
                                typeDefaultRoot={typeDefaultRoot}
                                webDirectory={webDirectory}
                                setWebDirectory={(value) => {
                                    setWebDirectory(value);
                                    clearFieldError('web_directory');
                                }}
                                spaFallback={spaFallback}
                                setSpaFallback={setSpaFallback}
                                clientMaxBodySize={clientMaxBodySize}
                                setClientMaxBodySize={(value) => {
                                    setClientMaxBodySize(value);
                                    clearFieldError('client_max_body_size');
                                }}
                                advancedOpen={advancedOpen}
                                setAdvancedOpen={setAdvancedOpen}
                                appEnv={appEnv}
                                setAppEnv={setAppEnv}
                                databaseDriver={databaseDriver}
                                setDatabaseDriver={setDatabaseDriver}
                                databaseStrategy={databaseStrategy}
                                setDatabaseStrategy={setDatabaseStrategy}
                                databaseId={databaseId}
                                setDatabaseId={setDatabaseId}
                                databaseName={databaseName}
                                setDatabaseName={setDatabaseName}
                                redisEnabled={redisEnabled}
                                setRedisEnabled={setRedisEnabled}
                                siteName={siteName}
                                databases={databases}
                                errors={fieldErrors}
                            />
                        )}

                        {isReview && (
                            <ReviewStep
                                siteName={siteName}
                                typeLabel={selected?.label ?? siteType}
                                runtime={runtime}
                                phpVersion={phpVersion}
                                nodeVersion={nodeVersion}
                                packageManager={packageManager}
                                repository={repository}
                                repositoryBranch={repositoryBranch}
                                autoDeploy={autoDeploy}
                                resolvedRoot={resolvedRoot}
                                servesFromDisk={servesFromDisk}
                                siteType={siteType}
                                spaFallback={spaFallback}
                                clientMaxBodySize={clientMaxBodySize}
                                appEnv={appEnv}
                                databaseDriver={databaseDriver}
                                databaseStrategy={databaseStrategy}
                                databaseName={databaseName}
                                databaseId={databaseId}
                                databases={databases}
                                redisEnabled={redisEnabled}
                            />
                        )}
                    </DialogBody>

                    {/* Each side is wrapped: DialogFooter's mobile-first
                        flex-col-reverse stretches bare children to full width,
                        which pushes the primary action outside the dialog. */}
                    <DialogFooter className="justify-between sm:justify-between">
                        <div className="flex">
                            {stepIndex(step) > 0 ? (
                                <Button
                                    variant="ghost"
                                    onClick={goBack}
                                    disabled={processing}
                                >
                                    <ArrowLeft />
                                    Back
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={() => setOpen(false)}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <div className="flex">
                            {isReview ? (
                                <Button
                                    variant="primary"
                                    onClick={handleCreate}
                                    disabled={
                                        processing || missingRuntime || !armed
                                    }
                                >
                                    <Rocket />
                                    {processing
                                        ? 'Creating…'
                                        : `Create ${siteName || 'site'}`}
                                </Button>
                            ) : (
                                <Button variant="primary" onClick={goNext}>
                                    Continue
                                    <ArrowRight />
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* -------------------------------------------------------------- Step: site */

function SiteStep({
    siteTypes,
    siteType,
    onSiteTypeChange,
    siteName,
    onSiteNameChange,
    error,
}: {
    siteTypes: SiteTypeOption[];
    siteType: string;
    onSiteTypeChange: (value: string) => void;
    siteName: string;
    onSiteNameChange: (value: string) => void;
    error?: string;
}) {
    return (
        <>
            <FormSection
                title="Application type"
                description="Determines the nginx template, the runtime, and what Beacon writes into .env."
            >
                <ChoiceCardGroup columns={2} label="Application type">
                    {siteTypes.map((type) => (
                        <ChoiceCard
                            key={type.value}
                            name="type"
                            value={type.value}
                            checked={siteType === type.value}
                            onSelect={onSiteTypeChange}
                            icon={
                                <SiteFrameworkIcon
                                    type={type.value}
                                    className="size-4"
                                />
                            }
                            title={type.label}
                            description={type.description}
                        />
                    ))}
                </ChoiceCardGroup>
            </FormSection>

            <FormDivider />

            <FormSection
                title="Domain"
                description="The primary hostname. Point its DNS at this server before requesting a certificate."
            >
                <Field
                    label="Domain name"
                    htmlFor="site-name"
                    required
                    error={error}
                    help="Lowercase, no protocol or trailing slash — for example app.example.com"
                >
                    <Input
                        id="site-name"
                        value={siteName}
                        onChange={(event) =>
                            onSiteNameChange(event.target.value)
                        }
                        placeholder="app.example.com"
                        autoComplete="off"
                        spellCheck={false}
                        aria-invalid={error ? true : undefined}
                    />
                </Field>
            </FormSection>
        </>
    );
}

/* --------------------------------------------------------------- Step: git */

function GitStep({
    github,
    repository,
    onRepositoryChange,
    repositoryOptions,
    repoLoading,
    repositoryBranch,
    onBranchChange,
    branchOptions,
    branchLoading,
    autoDeploy,
    onAutoDeployChange,
    errors,
}: {
    github: { connected: boolean };
    repository: string;
    onRepositoryChange: (value: string) => void;
    repositoryOptions: SearchableComboboxOption[];
    repoLoading: boolean;
    repositoryBranch: string;
    onBranchChange: (value: string) => void;
    branchOptions: SearchableComboboxOption[];
    branchLoading: boolean;
    autoDeploy: boolean;
    onAutoDeployChange: (value: boolean) => void;
    errors: FieldErrors;
}) {
    const hasRepository = repository.trim() !== '';

    return (
        <FormSection
            title="Source repository"
            description="Optional. You can skip this and connect a repository from the site's Deployments tab later."
        >
            <Field
                label="Repository"
                htmlFor="repository"
                optional
                error={errors.repository}
                help={
                    github.connected
                        ? 'Pick from your connected GitHub account, or type any Git URL.'
                        : 'Type a Git URL. Connect GitHub in Settings for a searchable picker and push deploys.'
                }
            >
                <SearchableCombobox
                    id="repository"
                    value={repository}
                    onValueChange={onRepositoryChange}
                    options={repositoryOptions}
                    loading={repoLoading}
                    mono
                    placeholder={
                        github.connected
                            ? 'Search repositories…'
                            : 'git@github.com:owner/repo.git'
                    }
                    emptyMessage={
                        github.connected
                            ? 'No repositories match.'
                            : 'Type a Git URL.'
                    }
                    portalled
                />
            </Field>

            <Field
                label="Branch"
                htmlFor="repository-branch"
                error={errors.repository_branch}
                help={
                    hasRepository
                        ? 'The branch Beacon tracks for deployments.'
                        : 'Choose a repository first.'
                }
            >
                <SearchableCombobox
                    id="repository-branch"
                    value={repositoryBranch}
                    onValueChange={onBranchChange}
                    options={branchOptions}
                    loading={branchLoading}
                    mono
                    disabled={!hasRepository}
                    placeholder={branchLoading ? 'Loading…' : 'main'}
                    emptyMessage="No branches found."
                    portalled
                />
            </Field>

            {hasRepository && (
                <ToggleRow
                    id="auto-deploy"
                    label="Deploy automatically on push"
                    description="Beacon deploys whenever the tracked branch moves, via webhook or polling."
                    checked={autoDeploy}
                    onChange={onAutoDeployChange}
                />
            )}
        </FormSection>
    );
}

/* --------------------------------------------------------- Step: configure */

function ConfigureStep(props: {
    siteType: string;
    runtime: 'php' | 'node' | 'none';
    missingRuntime: boolean;
    phpVersions: RuntimeOption[];
    phpVersion: string;
    setPhpVersion: (value: string) => void;
    nodeVersions: RuntimeOption[];
    nodeVersion: string;
    setNodeVersion: (value: string) => void;
    servesFromDisk: boolean;
    typeDefaultRoot: string;
    webDirectory: string;
    setWebDirectory: (value: string) => void;
    spaFallback: boolean;
    setSpaFallback: (value: boolean) => void;
    clientMaxBodySize: string;
    setClientMaxBodySize: (value: string) => void;
    advancedOpen: boolean;
    setAdvancedOpen: (value: boolean) => void;
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
    errors: FieldErrors;
}) {
    const {
        siteType,
        runtime,
        missingRuntime,
        phpVersions,
        phpVersion,
        setPhpVersion,
        nodeVersions,
        nodeVersion,
        setNodeVersion,
        servesFromDisk,
        typeDefaultRoot,
        webDirectory,
        setWebDirectory,
        spaFallback,
        setSpaFallback,
        clientMaxBodySize,
        setClientMaxBodySize,
        advancedOpen,
        setAdvancedOpen,
        errors,
    } = props;

    const presets = WEB_DIRECTORY_PRESETS[siteType] ?? [];

    return (
        <>
            {runtime !== 'none' && (
                <FormSection
                    title="Runtime"
                    description={
                        runtime === 'php'
                            ? 'Only versions installed on this server are listed.'
                            : 'Used for installs, builds, and the SSR process.'
                    }
                >
                    {missingRuntime ? (
                        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-[13px] leading-5 text-base-content">
                            <ServerIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                            <span>
                                No {runtime === 'php' ? 'PHP' : 'Node'} runtime
                                is installed. Install one from the{' '}
                                {runtime === 'php' ? 'PHP' : 'Runtimes'} page
                                before creating this site.
                            </span>
                        </div>
                    ) : runtime === 'php' ? (
                        <Field
                            label="PHP version"
                            htmlFor="php-version"
                            required
                            error={errors.php_version}
                        >
                            <Select
                                value={phpVersion}
                                onValueChange={setPhpVersion}
                            >
                                <SelectTrigger id="php-version">
                                    <SelectValue placeholder="Select a version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {phpVersions.map((version) => (
                                        <SelectItem
                                            key={version.value}
                                            value={version.value}
                                        >
                                            PHP {version.label}
                                            {version.is_default
                                                ? ' — default'
                                                : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    ) : (
                        <Field
                            label="Node version"
                            htmlFor="node-version"
                            required
                            error={errors.node_version}
                        >
                            <Select
                                value={nodeVersion}
                                onValueChange={setNodeVersion}
                            >
                                <SelectTrigger id="node-version">
                                    <SelectValue placeholder="Select a version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {nodeVersions.map((version) => (
                                        <SelectItem
                                            key={version.value}
                                            value={version.value}
                                        >
                                            Node {version.label}
                                            {version.is_default
                                                ? ' — default'
                                                : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    )}
                </FormSection>
            )}

            {siteType === 'laravel' && (
                <>
                    <FormDivider />
                    <CreateSiteLaravelStack
                        appEnv={props.appEnv}
                        setAppEnv={props.setAppEnv}
                        databaseDriver={props.databaseDriver}
                        setDatabaseDriver={props.setDatabaseDriver}
                        databaseStrategy={props.databaseStrategy}
                        setDatabaseStrategy={props.setDatabaseStrategy}
                        databaseId={props.databaseId}
                        setDatabaseId={props.setDatabaseId}
                        databaseName={props.databaseName}
                        setDatabaseName={props.setDatabaseName}
                        redisEnabled={props.redisEnabled}
                        setRedisEnabled={props.setRedisEnabled}
                        siteName={props.siteName}
                        databases={props.databases}
                        errors={props.errors}
                    />
                </>
            )}

            <FormDivider />

            <FormSection
                title="Serving"
                description="Where nginx looks for files, and how large an upload it accepts."
                aside={
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAdvancedOpen(!advancedOpen)}
                    >
                        <SlidersHorizontal />
                        {advancedOpen ? 'Hide advanced' : 'Advanced'}
                    </Button>
                }
            >
                {servesFromDisk ? (
                    <Field
                        label="Document root"
                        htmlFor="web-directory"
                        error={errors.web_directory}
                        help={
                            <>
                                Relative to the site directory. Defaults to{' '}
                                <code className="rounded bg-base-200 px-1 py-px font-mono text-[11px]">
                                    {typeDefaultRoot || '/'}
                                </code>
                                .
                            </>
                        }
                    >
                        <Input
                            id="web-directory"
                            mono
                            value={webDirectory}
                            onChange={(event) =>
                                setWebDirectory(event.target.value)
                            }
                            placeholder={typeDefaultRoot || '/'}
                            aria-invalid={
                                errors.web_directory ? true : undefined
                            }
                        />

                        {presets.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {presets.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setWebDirectory(preset)}
                                        className={cn(
                                            'rounded-lg border px-2 py-1 font-mono text-[11px] transition-colors',
                                            (webDirectory ||
                                                typeDefaultRoot) === preset
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-base-300 bg-base-100 text-base-content/70 hover:border-base-content/25 hover:bg-base-200',
                                        )}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        )}
                    </Field>
                ) : (
                    <div className="flex items-start gap-2.5 rounded-xl border border-base-300 bg-base-200/50 px-4 py-3 text-[13px] leading-5 text-base-content/70">
                        <Terminal className="mt-0.5 size-4 shrink-0 text-base-content/50" />
                        <span>
                            This site is served by a Node process behind an
                            nginx reverse proxy. Beacon allocates the port and
                            manages the process with Supervisor.
                        </span>
                    </div>
                )}

                {siteType === 'static' && (
                    <ToggleRow
                        id="spa-fallback"
                        label="Single-page app fallback"
                        description="Serve index.html for unmatched routes instead of returning 404."
                        checked={spaFallback}
                        onChange={setSpaFallback}
                    />
                )}

                {advancedOpen && (
                    <FormGrid columns={2}>
                        <Field
                            label="Max upload size"
                            htmlFor="client-max-body-size"
                            optional
                            error={errors.client_max_body_size}
                            help="nginx client_max_body_size — e.g. 100M"
                        >
                            <Input
                                id="client-max-body-size"
                                mono
                                value={clientMaxBodySize}
                                onChange={(event) =>
                                    setClientMaxBodySize(event.target.value)
                                }
                                placeholder="100M"
                                aria-invalid={
                                    errors.client_max_body_size
                                        ? true
                                        : undefined
                                }
                            />
                        </Field>
                    </FormGrid>
                )}
            </FormSection>
        </>
    );
}

/* ------------------------------------------------------------ Step: review */

function ReviewStep(props: {
    siteName: string;
    typeLabel: string;
    runtime: 'php' | 'node' | 'none';
    phpVersion: string;
    nodeVersion: string;
    packageManager: string;
    repository: string;
    repositoryBranch: string;
    autoDeploy: boolean;
    resolvedRoot: string;
    servesFromDisk: boolean;
    siteType: string;
    spaFallback: boolean;
    clientMaxBodySize: string;
    appEnv: AppEnv;
    databaseDriver: DatabaseDriver;
    databaseStrategy: DatabaseStrategy;
    databaseName: string;
    databaseId: string;
    databases: DatabaseOption[];
    redisEnabled: boolean;
}) {
    const linkedDatabase =
        props.databaseStrategy === 'existing'
            ? props.databases.find(
                  (entry) => String(entry.id) === props.databaseId,
              )?.name
            : props.databaseStrategy === 'create'
              ? props.databaseName
              : null;

    const willCreateDatabase =
        props.siteType === 'laravel' &&
        props.databaseDriver === 'mysql' &&
        props.databaseStrategy === 'create';

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3.5">
                <Rocket className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex flex-col gap-0.5">
                    <p className="text-[13px] leading-5 font-medium text-base-content">
                        Nothing has been created yet.
                    </p>
                    <p className="text-[12px] leading-4 text-base-content/60">
                        Review the summary below, then choose Create. Beacon
                        will write the nginx vhost, the PHP-FPM pool, and the
                        site directory
                        {willCreateDatabase
                            ? ', and provision the database.'
                            : '.'}
                    </p>
                </div>
            </div>

            <ReviewCard icon={<Globe className="size-4" />} title="Site">
                <SummaryRow label="Domain" value={props.siteName} mono />
                <SummaryRow label="Type" value={props.typeLabel} />
                {props.runtime === 'php' && (
                    <SummaryRow
                        label="PHP"
                        value={props.phpVersion || '—'}
                        mono
                    />
                )}
                {props.runtime === 'node' && (
                    <>
                        <SummaryRow
                            label="Node"
                            value={props.nodeVersion || '—'}
                            mono
                        />
                        <SummaryRow
                            label="Package manager"
                            value={props.packageManager}
                        />
                    </>
                )}
            </ReviewCard>

            <ReviewCard
                icon={<GitBranch className="size-4" />}
                title="Repository"
            >
                {props.repository.trim() ? (
                    <>
                        <SummaryRow
                            label="Repository"
                            value={props.repository}
                            mono
                        />
                        <SummaryRow
                            label="Branch"
                            value={props.repositoryBranch || '—'}
                            mono
                        />
                        <SummaryRow
                            label="Auto deploy"
                            value={props.autoDeploy ? 'On push' : 'Manual'}
                        />
                    </>
                ) : (
                    <p className="py-1.5 text-[12px] leading-5 text-base-content/55">
                        No repository connected. You can add one later.
                    </p>
                )}
            </ReviewCard>

            {props.siteType === 'laravel' && (
                <ReviewCard
                    icon={<DatabaseIcon className="size-4" />}
                    title="Services"
                >
                    <SummaryRow label="Environment" value={props.appEnv} />
                    <SummaryRow
                        label="Database"
                        value={
                            props.databaseDriver === 'sqlite'
                                ? 'SQLite (file)'
                                : linkedDatabase
                                  ? `${linkedDatabase}${willCreateDatabase ? ' (new)' : ' (existing)'}`
                                  : 'None'
                        }
                        mono={Boolean(linkedDatabase)}
                    />
                    <SummaryRow
                        label="Redis"
                        value={props.redisEnabled ? 'Enabled' : 'Disabled'}
                    />
                </ReviewCard>
            )}

            <ReviewCard
                icon={<FolderTree className="size-4" />}
                title="Serving"
            >
                {props.servesFromDisk ? (
                    <SummaryRow
                        label="Document root"
                        value={props.resolvedRoot}
                        mono
                    />
                ) : (
                    <SummaryRow
                        label="Serving"
                        value="Reverse proxy to Node"
                    />
                )}
                {props.siteType === 'static' && (
                    <SummaryRow
                        label="SPA fallback"
                        value={props.spaFallback ? 'Enabled' : 'Disabled'}
                    />
                )}
                <SummaryRow
                    label="Max upload"
                    value={props.clientMaxBodySize || 'Server default'}
                    mono={Boolean(props.clientMaxBodySize)}
                />
            </ReviewCard>
        </div>
    );
}

function ReviewCard({
    icon,
    title,
    children,
}: {
    icon: ReactNode;
    title: string;
    children: ReactNode;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
            <div className="flex items-center gap-2 border-b border-base-300 bg-base-200/40 px-4 py-2">
                <span className="text-base-content/50">{icon}</span>
                <span className="text-[11px] font-semibold tracking-[0.06em] text-base-content/60 uppercase">
                    {title}
                </span>
            </div>
            <dl className="divide-y divide-base-300/60 px-4 py-1.5">
                {children}
            </dl>
        </div>
    );
}
