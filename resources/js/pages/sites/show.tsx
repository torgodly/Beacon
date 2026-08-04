import {
    Form,
    Head,
    Link,
    router,
    setLayoutProps,
    useForm,
    usePage,
} from '@inertiajs/react';
import { Clock, Cog, Cpu, Eye, GitBranch, History, Key, Lock, MoreHorizontal, Pencil, Play, Plus, RefreshCw, RotateCcw, Save, Shield, Terminal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CodeDiffViewer } from '@/components/code-diff-viewer';
import { CodeEditor } from '@/components/code-editor';
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
import {
    ForgeFrameworkBadge,
    ForgeStatusBadge,
} from '@/components/forge/forge-badge';
import { ForgeDeploymentsSection } from '@/components/forge/forge-deployments-list';
import { ForgeFormCard, ForgePageContent } from '@/components/forge/forge-form-card';
import {
    ForgeFormPreview,
    ForgeFormRow,
    ForgeFormRows,
    ForgeFormTabs,
} from '@/components/forge/forge-form-row';
import {
    ForgeActionGroup,
    ForgeEmptyState,
} from '@/components/forge/forge-empty-state';
import { Panel, SpecList, StatCluster } from '@/components/console/panel';
import { DeployScriptEnvReference } from '@/components/deploy-script-env-reference';
import InputError from '@/components/input-error';
import {
    SearchableCombobox,
    type SearchableComboboxOption,
} from '@/components/searchable-combobox';
import { CommandLogViewer } from '@/components/sites/command-log-viewer';
import { DeployButton } from '@/components/sites/deploy-button';
import { SiteMetaBadges } from '@/components/sites/site-meta-badges';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SiteSummary } from '@/layouts/site/layout';
import { cn } from '@/lib/utils';
import {
    hostnameError,
    normalizeHostname,
    requiredTextError,
    supervisorProcessNameError,
} from '@/lib/validation';
import {
    consoleCommandPlaceholder,
    defaultCronCommand,
    defaultSupervisorCommand,
    defaultSupervisorProcessKind,
    phpBinary,
    siteHasConfigCacheOnSave,
    siteHasLaravelScheduler,
    supervisorProcessTabOptions,
} from '@/lib/site-runtime-commands';
import { destroy, index as sitesIndex, show } from '@/routes/sites';
import {
    store as storeSiteCommand,
} from '@/routes/sites/commands';
import {
    store as storeCronJob,
    destroy as destroyCronJob,
    scheduler as toggleCronScheduler,
} from '@/routes/sites/cron';
import { store as generateDeployKey } from '@/routes/sites/deploy-key';
import { update as updateDeployScript } from '@/routes/sites/deploy-script';
import {
    destroy as destroyDomain,
    primary as makePrimaryDomain,
    settings as updateDomainSettings,
    store as storeDomain,
} from '@/routes/sites/domains';
import {
    update as updateEnvironment,
    restore as restoreEnvironmentSnapshot,
} from '@/routes/sites/environment';
import {
    branches as githubBranches,
    repositories as githubRepositories,
} from '@/routes/sites/github';
import { update as updateIsolation } from '@/routes/sites/isolation';
import {
    reset as resetNginxRoute,
    update as updateNginx,
} from '@/routes/sites/nginx';
import { update as updateSiteRuntime } from '@/routes/sites/runtime';
import { update as updateServing } from '@/routes/sites/serving';
import { update as updateSiteSettings } from '@/routes/sites/settings';
import { destroy as destroySsl, issue as issueSsl } from '@/routes/sites/ssl';
import {
    store as storeSupervisorProcess,
    destroy as destroySupervisorProcess,
    restart as restartSupervisorProcess,
} from '@/routes/sites/supervisor';

type DomainRow = {
    id: number;
    domain: string;
    is_primary: boolean;
    redirect_to: string | null;
    redirect_status_code: number | null;
};

type SslCertificatePayload = {
    id: number;
    lineage: string;
    domains: string[];
    status: string;
    expires_at: string | null;
    days_remaining: number;
    auto_renew: boolean;
};

type SiteSettingsPayload = {
    repository: string | null;
    repository_branch: string;
    repository_provider: string;
    auto_deploy: boolean;
    deploy_trigger: string;
    poll_interval_seconds: number | null;
    default_poll_interval_seconds: number;
    deploy_key_public: string | null;
    github: {
        connected: boolean;
        account_login: string | null;
        selected_repo_id: number | null;
        selected_repository: string | null;
    };
};

type GitHubRepositoryOption = {
    id: number;
    full_name: string;
    default_branch: string | null;
};

type SiteDetail = SiteSummary &
    ServingFields & {
        path: string;
        web_directory: string;
        php_version: string | null;
        app_env: 'testing' | 'staging' | 'production' | null;
        database_driver: 'mysql' | 'sqlite' | null;
        redis_enabled: boolean;
        node_version: string | null;
        proxy_port: number | null;
        nginx_customized: boolean;
        open_basedir: boolean;
        strict_functions: boolean;
        open_basedir_extra_paths: string[];
        domains: DomainRow[];
        ssl_status: string;
        status: string;
        type: string;
        deployment_status: string;
        primary_domain: string;
        repository: string | null;
        repository_branch: string;
        repository_connected: boolean;
        auto_deploy: boolean;
        deploy_trigger: string;
        poll_interval_seconds: number | null;
        effective_poll_interval_seconds: number;
        allow_wildcard_subdomains: boolean;
        env_cache_on_save: boolean;
        system_user?: string;
        created_at?: string | null;
    };

type ServingFields = {
    spa_fallback: boolean;
    client_max_body_size: string | null;
    package_manager: string | null;
    serves_from_disk: boolean;
};

type NginxPayload = {
    contents: string;
    generated: string;
    customized: boolean;
};

type DeploymentRow = {
    uuid: string;
    status: string;
    trigger: string;
    branch: string | null;
    commit_sha: string | null;
    commit_message: string | null;
    commit_author: string | null;
    duration_ms: number | null;
    exit_code: number | null;
    failed_step: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string | null;
};

type SupervisorProcessRow = {
    id: number;
    name: string;
    program_name: string;
    kind: string;
    connection: string | null;
    queue: string | null;
    numprocs: number;
    status: string;
    status_message: string | null;
    log_path: string | null;
    is_system: boolean;
    last_status_at: string | null;
};

type CronJobRow = {
    id: number;
    name: string;
    command: string;
    expression: string;
    frequency_preset: string | null;
    is_laravel_scheduler: boolean;
    enabled: boolean;
};

type EnvironmentPayload = {
    contents: string;
    env_cache_on_save: boolean;
    snapshots: Array<{
        id: number;
        created_at: string | null;
        contents: string;
    }>;
};

type ConsoleCommandRow = {
    uuid: string;
    command: string;
    status: string;
    exit_code: number | null;
    duration_ms: number | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string | null;
};

type EnvReferenceRow = {
    name: string;
    description: string;
    example: string | null;
};

type RuntimeOptionsPayload = {
    php_versions: string[];
    node_versions: string[];
};

type Props = {
    site: SiteDetail;
    tab: string;
    nginx: NginxPayload | null;
    deployments: DeploymentRow[] | null;
    deployScript: string | null;
    deployEnvReference: EnvReferenceRow[] | null;
    activeDeployment: DeploymentRow | null;
    latestDeployment: DeploymentRow | null;
    sslCertificate: SslCertificatePayload | null;
    siteSettings: SiteSettingsPayload | null;
    runtimeOptions: RuntimeOptionsPayload | null;
    supervisorProcesses: SupervisorProcessRow[] | null;
    cronJobs: CronJobRow[] | null;
    environment: EnvironmentPayload | null;
    consoleCommands: ConsoleCommandRow[] | null;
    activeCommand: ConsoleCommandRow | null;
};

function deploymentStatus(status: string): Status {
    return ({
        success: 'success',
        running: 'running',
        queued: 'pending',
        failed: 'failed',
        cancelled: 'stopped',
    }[status] ?? 'info') as Status;
}

function formatDuration(ms: number | null): string {
    if (ms === null) {
        return '—';
    }

    if (ms < 1000) {
        return `${ms}ms`;
    }

    return `${(ms / 1000).toFixed(1)}s`;
}

function sslStatus(status: string): Status {
    return ({
        issued: 'success',
        pending: 'pending',
        expired: 'failed',
        none: 'info',
    }[status] ?? 'info') as Status;
}

function OverviewTab({
    site,
    deployments,
    supervisorProcesses,
    cronJobs,
}: {
    site: SiteDetail;
    deployments: DeploymentRow[];
    supervisorProcesses: SupervisorProcessRow[];
    cronJobs: CronJobRow[];
}) {
    const page = usePage<{ server?: { public_ip: string } }>();
    const publicIp = page.props.server?.public_ip ?? '—';

    const formatDate = (iso: string | null | undefined) =>
        iso
            ? new Date(iso).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
              })
            : '—';

    return (
        <ForgePageLayout
            main={
                <>
                    <ForgeDividedCard title="Repository">
                        <ForgeListRow>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    {site.repository_connected
                                        ? 'Connected'
                                        : 'Not connected'}
                                </p>
                                <p className="truncate font-mono text-xs text-[#64748b]">
                                    {site.repository_connected
                                        ? `${site.repository}:${site.repository_branch}`
                                        : site.path}
                                </p>
                            </div>
                            <SiteMetaBadges site={site} layout="inline" />
                            <ForgeStatusBadge
                                label={
                                    site.repository_connected
                                        ? 'Connected'
                                        : 'Pending'
                                }
                            />
                        </ForgeListRow>
                    </ForgeDividedCard>

                    <ForgeDeploymentsSection
                        siteId={site.id}
                        deployments={deployments}
                        limit={5}
                    />

                    <ForgeDividedCard title="Background Processes">
                        {supervisorProcesses.length === 0 ? (
                            <ForgeListRow className="text-[#64748b]">
                                No workers configured.
                            </ForgeListRow>
                        ) : (
                            supervisorProcesses.map((process) => (
                                <ForgeListRow key={process.id}>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                            {process.name}
                                        </p>
                                        <p className="truncate font-mono text-xs text-[#64748b]">
                                            {process.program_name}
                                        </p>
                                    </div>
                                    <ForgeStatusBadge
                                        label={
                                            process.status === 'running'
                                                ? 'Running'
                                                : process.status
                                        }
                                        pulse={process.status === 'running'}
                                    />
                                </ForgeListRow>
                            ))
                        )}
                    </ForgeDividedCard>

                    <ForgeDividedCard title="Scheduled Jobs">
                        {cronJobs.length === 0 ? (
                            <ForgeListRow className="text-[#64748b]">
                                No scheduled jobs.
                            </ForgeListRow>
                        ) : (
                            cronJobs.map((job) => (
                                <ForgeListRow key={job.id}>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                            {job.name}
                                        </p>
                                        <p className="text-xs text-[#64748b]">
                                            {job.frequency_preset ??
                                                job.expression}
                                        </p>
                                    </div>
                                    <ForgeStatusBadge
                                        label={job.enabled ? 'Installed' : 'Disabled'}
                                    />
                                </ForgeListRow>
                            ))
                        )}
                    </ForgeDividedCard>

                    <ForgeDividedCard title="Danger zone">
                        <ForgeListRow className="flex-col items-start gap-3 sm:flex-row sm:items-center">
                            <p className="flex-1 text-sm text-[#64748b]">
                                Permanently removes Nginx, SSL, runtime pools,
                                workers, cron, deploy keys, logs, and the site
                                directory.
                            </p>
                            <ConfirmDialog
                                trigger={
                                    <Button variant="destructive" size="sm">
                                        <Trash2 className="size-3.5" />
                                        Delete site
                                    </Button>
                                }
                                title={`Delete ${site.name}?`}
                                description="This cannot be undone."
                                confirmLabel="Delete site"
                                destructive
                                confirmationValue={site.name}
                                onConfirm={() =>
                                    router.delete(destroy.url(site.id), {
                                        data: { confirmation: site.name },
                                    })
                                }
                            />
                        </ForgeListRow>
                    </ForgeDividedCard>
                </>
            }
            sidebar={
                <>
                    <ForgeDetailsSection title="Details">
                        <ForgeDetailRow label="Site" value={site.name} mono />
                        <ForgeDetailRow
                            label="Site user"
                            value={site.system_user ?? 'beacon'}
                            mono
                        />
                        <ForgeDetailRow
                            label="Framework"
                            value={<ForgeFrameworkBadge type={site.type} />}
                        />
                        {site.php_version && (
                            <ForgeDetailRow
                                label="PHP"
                                value={`PHP ${site.php_version}`}
                                mono
                            />
                        )}
                        {site.type === 'laravel' && site.app_env && (
                            <>
                                <ForgeDetailRow
                                    label="Environment"
                                    value={
                                        site.app_env.charAt(0).toUpperCase() +
                                        site.app_env.slice(1)
                                    }
                                />
                                <ForgeDetailRow
                                    label="Database"
                                    value={
                                        site.database_driver === 'sqlite'
                                            ? 'SQLite'
                                            : 'MySQL'
                                    }
                                />
                                <ForgeDetailRow
                                    label="Redis"
                                    value={site.redis_enabled ? 'Enabled' : 'Disabled'}
                                />
                            </>
                        )}
                        <ForgeDetailRow
                            label="Web root"
                            value={site.web_directory}
                            mono
                        />
                        <ForgeDetailRow
                            label="Created"
                            value={formatDate(site.created_at)}
                        />
                    </ForgeDetailsSection>

                    <ForgeDetailsSection title="Networking">
                        <ForgeDetailRow
                            label="Public IP"
                            value={publicIp}
                            mono
                            copyable
                        />
                    </ForgeDetailsSection>
                </>
            }
        />
    );
}

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

function NginxConfigDialog({
    site,
    nginx,
}: {
    site: SiteDetail;
    nginx: NginxPayload;
}) {
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };
    const errorLine = errors.error_line
        ? Number.parseInt(errors.error_line, 10)
        : undefined;
    const [open, setOpen] = useState(false);
    const form = useForm({
        contents: nginx.contents,
    });

    useEffect(() => {
        form.setData('contents', nginx.contents);
    }, [nginx.contents]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <Pencil className="size-3.5" />
                    Edit Nginx configuration
                </Button>
            </DialogTrigger>
            <DialogContent size="xl">
                <DialogHeader
                    tone="default"
                    eyebrow="Nginx"
                    icon={<Cog className="size-5" />}
                >
                    <DialogTitle>Nginx configuration</DialogTitle>
                    <DialogDescription>
                        {nginx.customized
                            ? 'This configuration has been customized and will not be overwritten automatically.'
                            : 'Edits mark the config as customized. Reset to regenerate from site settings.'}
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-4">
                    <ConfirmDialog
                        trigger={
                            <Button type="button" variant="outline" size="sm">
                                <RotateCcw className="size-3.5" />
                                Reset to generated
                            </Button>
                        }
                        title="Reset nginx to generated template?"
                        description="Review the diff below. Saving will replace your customized configuration."
                        confirmLabel="Reset configuration"
                        onConfirm={() =>
                            router.post(
                                resetNginxRoute.url(site.id),
                                {},
                                {
                                    preserveScroll: true,
                                    onSuccess: () => setOpen(false),
                                },
                            )
                        }
                    >
                        <CodeDiffViewer
                            oldValue={form.data.contents}
                            newValue={nginx.generated}
                            oldTitle="Current"
                            newTitle="Generated"
                        />
                    </ConfirmDialog>
                    <form
                        id="nginx-config-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.patch(updateNginx.url(site.id), {
                                preserveScroll: true,
                                onSuccess: () => setOpen(false),
                            });
                        }}
                        className="space-y-3"
                    >
                        <CodeEditor
                            value={form.data.contents}
                            onChange={(value) => form.setData('contents', value)}
                            language="nginx"
                            errorLine={errorLine}
                            rows={22}
                        />
                        <InputError message={form.errors.contents} />
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="submit"
                        form="nginx-config-form"
                        disabled={form.processing}
                    >
                        <Save className="size-3.5" />
                        Save configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DomainsTab({
    site,
    nginx,
}: {
    site: SiteDetail;
    nginx: NginxPayload;
}) {
    const primaryDomain =
        site.domains.find((domain) => domain.is_primary)?.domain ?? site.name;
    const [redirectWww, setRedirectWww] = useState(false);
    const [wildcardEnabled, setWildcardEnabled] = useState(
        site.allow_wildcard_subdomains,
    );
    const domainForm = useForm({
        domain: '',
        redirect_www: false,
    });
    const domainValid =
        hostnameError(domainForm.data.domain) === undefined;

    return (
        <ForgePageContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                        Domains
                    </h2>
                    <p className="text-sm text-[#64748b]">
                        Hostnames that serve this site. Configure certificates on
                        the{' '}
                        <Link
                            href={show.url(site.id, { query: { tab: 'ssl' } })}
                            className="font-medium text-[#18B69B] hover:underline"
                        >
                            TLS tab
                        </Link>
                        .
                    </p>
                </div>
                <NginxConfigDialog site={site} nginx={nginx} />
            </div>

            <ForgeDividedCard title="Hostnames">
                <ForgeListRow className="flex-col items-stretch gap-4 border-b border-[#e2e8f0] dark:border-[#2e3032]">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();

                            const error = hostnameError(
                                domainForm.data.domain,
                            );

                            if (error) {
                                domainForm.setError('domain', error);
                                return;
                            }

                            domainForm.clearErrors('domain');
                            domainForm.transform((data) => ({
                                ...data,
                                domain: normalizeHostname(data.domain),
                                redirect_www: redirectWww,
                            }));
                            domainForm.post(storeDomain.url(site.id), {
                                preserveScroll: true,
                                onSuccess: () => {
                                    domainForm.reset();
                                    setRedirectWww(false);
                                },
                            });
                        }}
                        className="flex flex-col gap-3 sm:flex-row"
                    >
                        <div className="min-w-0 flex-1">
                            <Input
                                id="domain"
                                value={domainForm.data.domain}
                                onChange={(event) =>
                                    domainForm.setData(
                                        'domain',
                                        normalizeHostname(
                                            event.target.value,
                                        ),
                                    )
                                }
                                placeholder="another-domain.com"
                                autoComplete="off"
                            />
                            <InputError message={domainForm.errors.domain} />
                        </div>
                        <Button
                            type="submit"
                            disabled={domainForm.processing || !domainValid}
                            className="shrink-0"
                        >
                            Add domain
                        </Button>
                    </form>

                    <label className="flex items-start gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 dark:border-[#2e3032] dark:bg-[#151718]">
                        <Checkbox
                            id="redirect_www"
                            checked={redirectWww}
                            onCheckedChange={(checked) =>
                                setRedirectWww(checked === true)
                            }
                            className="mt-0.5"
                        />
                        <span className="grid gap-1">
                            <span className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                Also redirect www
                            </span>
                            <span className="text-sm text-[#64748b]">
                                Adds www and sends it to the apex domain.
                            </span>
                        </span>
                    </label>
                </ForgeListRow>

                {site.domains.map((domain) => (
                    <ForgeListRow
                        key={domain.id}
                        className="flex-wrap justify-between gap-3"
                    >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-[#0f172a] dark:text-[#f8fafc]">
                                {domain.domain}
                            </span>
                            {domain.is_primary && (
                                <span className="rounded-full bg-[#18B69B]/10 px-2 py-0.5 text-xs font-medium text-[#0d9488] dark:text-[#18B69B]">
                                    Primary
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {domain.redirect_to ? (
                                <span className="text-xs text-[#64748b]">
                                    → {domain.redirect_to}
                                </span>
                            ) : domain.is_primary ? (
                                <span className="text-xs text-[#64748b]">
                                    www redirects here
                                </span>
                            ) : null}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Actions for ${domain.domain}`}
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {!domain.is_primary &&
                                        !domain.redirect_to && (
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    router.patch(
                                                        makePrimaryDomain.url(
                                                            {
                                                                site: site.id,
                                                                domain: domain.domain,
                                                            },
                                                        ),
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                Make primary
                                            </DropdownMenuItem>
                                        )}
                                    {!domain.is_primary && (
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() =>
                                                router.delete(
                                                    destroyDomain.url({
                                                        site: site.id,
                                                        domain: domain.domain,
                                                    }),
                                                    {
                                                        preserveScroll: true,
                                                    },
                                                )
                                            }
                                        >
                                            Remove
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </ForgeListRow>
                ))}
            </ForgeDividedCard>

            <ForgeDividedCard title="Wildcard subdomains">
                <ForgeListRow className="flex-wrap justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                            Accept any subdomain
                        </p>
                        <p className="text-sm text-[#64748b]">
                            Traffic to{' '}
                            <code className="rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-xs dark:bg-[#2e3032]">
                                *.{primaryDomain}
                            </code>{' '}
                            is routed to this site.
                        </p>
                    </div>
                    <ToggleSwitch
                        id="allow_wildcard_subdomains"
                        checked={wildcardEnabled}
                        onCheckedChange={(checked) => {
                            setWildcardEnabled(checked);
                            router.patch(
                                updateDomainSettings.url(site.id),
                                {
                                    allow_wildcard_subdomains: checked,
                                },
                                { preserveScroll: true },
                            );
                        }}
                    />
                </ForgeListRow>
            </ForgeDividedCard>
        </ForgePageContent>
    );
}

function SslTab({
    site,
    certificate,
}: {
    site: SiteDetail;
    certificate: SslCertificatePayload | null;
}) {
    const { auth } = usePage().props as {
        auth: { user: { email: string } | null };
    };
    const issueForm = useForm({
        email: auth.user?.email ?? '',
    });
    const hasCertificate = certificate !== null && site.ssl_status === 'issued';

    return (
        <ForgePageContent>
            <ForgeDividedCard
                title="TLS certificate"
                action={
                    hasCertificate ? (
                        <ForgeActionGroup>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={issueForm.processing}
                                onClick={() =>
                                    issueForm.post(issueSsl.url(site.id), {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                <RefreshCw className="size-3.5" />
                                Re-issue
                            </Button>
                        </ForgeActionGroup>
                    ) : null
                }
            >
                <ForgeListRow className="flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                            {hasCertificate
                                ? 'HTTPS is active'
                                : 'HTTPS not configured'}
                        </p>
                        <p className="text-sm text-[#64748b]">
                            {hasCertificate
                                ? "Let's Encrypt certificate is installed and Nginx is serving HTTPS."
                                : 'A certificate is requested automatically after each successful deployment. You can also issue one manually below.'}
                        </p>
                    </div>
                    <StatusBadge
                        status={sslStatus(site.ssl_status)}
                        label={
                            site.ssl_status === 'issued'
                                ? 'Secured'
                                : site.ssl_status
                        }
                    />
                </ForgeListRow>

                {hasCertificate && certificate ? (
                    <>
                        <ForgeListRow className="justify-between">
                            <span className="text-[#64748b]">Certificate</span>
                            <span className="font-mono text-xs text-[#0f172a] dark:text-[#f8fafc]">
                                {certificate.lineage}
                            </span>
                        </ForgeListRow>
                        <ForgeListRow className="justify-between">
                            <span className="text-[#64748b]">Domains</span>
                            <span className="max-w-md text-right font-mono text-xs text-[#0f172a] dark:text-[#f8fafc]">
                                {certificate.domains.join(', ')}
                            </span>
                        </ForgeListRow>
                        {certificate.expires_at && (
                            <ForgeListRow className="justify-between">
                                <span className="text-[#64748b]">Expires</span>
                                <span className="text-sm text-[#0f172a] dark:text-[#f8fafc]">
                                    {new Date(
                                        certificate.expires_at,
                                    ).toLocaleDateString()}{' '}
                                    <span className="text-[#64748b]">
                                        ({certificate.days_remaining} days)
                                    </span>
                                </span>
                            </ForgeListRow>
                        )}
                        <ForgeListRow>
                            <ConfirmDialog
                                trigger={
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="w-fit"
                                    >
                                        <Trash2 className="size-3.5" />
                                        Remove certificate
                                    </Button>
                                }
                                title="Remove TLS certificate?"
                                description="Visitors will lose HTTPS until a new certificate is issued. Nginx will be updated immediately."
                                confirmLabel="Remove certificate"
                                destructive
                                onConfirm={() =>
                                    router.delete(
                                        destroySsl.url({
                                            site: site.id,
                                            certificate: certificate.id,
                                        }),
                                        { preserveScroll: true },
                                    )
                                }
                            />
                        </ForgeListRow>
                    </>
                ) : (
                    <ForgeListRow className="flex-col items-stretch gap-4">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                issueForm.post(issueSsl.url(site.id), {
                                    preserveScroll: true,
                                });
                            }}
                            className="flex max-w-lg flex-col gap-3"
                        >
                            <div className="grid gap-2">
                                <Label htmlFor="ssl_email">
                                    Let&apos;s Encrypt email
                                </Label>
                                <Input
                                    id="ssl_email"
                                    type="email"
                                    value={issueForm.data.email}
                                    onChange={(event) =>
                                        issueForm.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="admin@example.com"
                                    autoComplete="email"
                                />
                                <InputError message={issueForm.errors.email} />
                            </div>
                            <Button
                                type="submit"
                                disabled={issueForm.processing}
                                className="w-fit"
                            >
                                <Shield className="size-3.5" />
                                Issue certificate now
                            </Button>
                        </form>
                    </ForgeListRow>
                )}
            </ForgeDividedCard>
        </ForgePageContent>
    );
}

function SettingsTab({
    site,
    settings,
    runtimeOptions,
}: {
    site: SiteDetail;
    settings: SiteSettingsPayload;
    runtimeOptions: RuntimeOptionsPayload;
}) {
    const [autoDeploy, setAutoDeploy] = useState(settings.auto_deploy);
    const [deployTrigger, setDeployTrigger] = useState(settings.deploy_trigger);
    const [pollIntervalSeconds, setPollIntervalSeconds] = useState(
        settings.poll_interval_seconds?.toString() ?? '',
    );
    const [repositories, setRepositories] = useState<GitHubRepositoryOption[]>(
        [],
    );
    const [repoLoading, setRepoLoading] = useState(false);
    const [branchLoading, setBranchLoading] = useState(false);
    const [branches, setBranches] = useState<string[]>([]);
    const [selectedRepoId, setSelectedRepoId] = useState<number | null>(
        settings.github.selected_repo_id,
    );
    const [selectedRepository, setSelectedRepository] = useState(
        settings.github.selected_repository ?? '',
    );
    const [repositoryBranch, setRepositoryBranch] = useState(
        settings.repository_branch,
    );
    const [useManualRepository, setUseManualRepository] = useState(
        !settings.github.connected || settings.repository_provider !== 'github',
    );
    const canLoadBranches =
        settings.github.connected &&
        !useManualRepository &&
        selectedRepository.includes('/');
    const visibleBranches = canLoadBranches ? branches : [];
    const repositoryOptions = useMemo<SearchableComboboxOption[]>(
        () =>
            repositories.map((repository) => ({
                value: repository.full_name,
                label: repository.full_name,
            })),
        [repositories],
    );
    const branchOptions = useMemo<SearchableComboboxOption[]>(
        () =>
            visibleBranches.map((branch) => ({
                value: branch,
                label: branch,
            })),
        [visibleBranches],
    );
    const { errors: pageErrors } = usePage().props as {
        errors: Record<string, string>;
    };
    const runtimeForm = useForm({
        php_version: site.php_version ?? '',
        node_version: site.node_version ?? '',
    });

    useEffect(() => {
        if (!settings.github.connected || useManualRepository) {
            return;
        }

        let cancelled = false;

        async function loadRepositories() {
            setRepoLoading(true);

            try {
                const response = await fetch(githubRepositories.url(site.id), {
                    headers: { Accept: 'application/json' },
                });

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    repositories: GitHubRepositoryOption[];
                };

                setRepositories(data.repositories);
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
    }, [settings.github.connected, site.id, useManualRepository]);

    useEffect(() => {
        if (!canLoadBranches) {
            return;
        }

        const [owner, repo] = selectedRepository.split('/');
        let cancelled = false;

        async function loadBranches() {
            setBranchLoading(true);

            try {
                const response = await fetch(
                    githubBranches.url({
                        site: site.id,
                        owner,
                        repo,
                    }),
                    { headers: { Accept: 'application/json' } },
                );

                if (!response.ok || cancelled) {
                    return;
                }

                const data = (await response.json()) as {
                    branches: Array<{ name: string }>;
                };

                setBranches(data.branches.map((branch) => branch.name));
            } finally {
                if (!cancelled) {
                    setBranchLoading(false);
                }
            }
        }

        void loadBranches();

        return () => {
            cancelled = true;
        };
    }, [canLoadBranches, selectedRepository, site.id]);

    function handleRepositoryChange(fullName: string) {
        const repository = repositories.find(
            (entry) => entry.full_name === fullName,
        );

        setSelectedRepository(fullName);
        setSelectedRepoId(repository?.id ?? null);

        if (repository?.default_branch) {
            setRepositoryBranch(repository.default_branch);
        }
    }

    return (
        <ForgePageLayout
            main={
                <>
                    <Panel
                        eyebrow="site // runtime"
                        title="Runtime stack"
                        description="Changing PHP regenerates the FPM pool and nginx vhost, then restarts PHP-FPM and Supervisor for this site."
                        icon={Cpu}
                    >
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                runtimeForm.patch(updateSiteRuntime.url(site.id), {
                                    preserveScroll: true,
                                });
                            }}
                            className="grid max-w-xl gap-4"
                        >

                        {site.php_version !== null && (
                            <div className="grid gap-2">
                                <Label htmlFor="php_version">PHP version</Label>
                                <Select
                                    value={runtimeForm.data.php_version}
                                    onValueChange={(value) =>
                                        runtimeForm.setData(
                                            'php_version',
                                            value,
                                        )
                                    }
                                >
                                    <SelectTrigger id="php_version">
                                        <SelectValue placeholder="Select PHP version" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {runtimeOptions.php_versions.map(
                                            (version) => (
                                                <SelectItem
                                                    key={version}
                                                    value={version}
                                                >
                                                    PHP {version}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                                <InputError
                                    message={runtimeForm.errors.php_version}
                                />
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="node_version">Node version</Label>
                            <Select
                                value={
                                    runtimeForm.data.node_version || '__none__'
                                }
                                onValueChange={(value) =>
                                    runtimeForm.setData(
                                        'node_version',
                                        value === '__none__' ? '' : value,
                                    )
                                }
                            >
                                <SelectTrigger id="node_version">
                                    <SelectValue placeholder="Select Node version" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none__">
                                        None
                                    </SelectItem>
                                    {runtimeOptions.node_versions.map(
                                        (version) => (
                                            <SelectItem
                                                key={version}
                                                value={version}
                                            >
                                                Node {version}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <InputError
                                message={runtimeForm.errors.node_version}
                            />
                        </div>

                        <InputError message={pageErrors.runtime} />

                        <Button
                            type="submit"
                            disabled={runtimeForm.processing}
                            className="w-fit"
                        >
                            <Save className="size-3.5" />
                            Save runtime
                        </Button>
                    </form>
                    </Panel>

                    <Panel
                        eyebrow="site // deploy"
                        title="Repository & deploy"
                        description="Connect GitHub or enter a repository URL, then configure how Beacon deploys changes."
                        icon={GitBranch}
                    >
                        <Form
                            {...updateSiteSettings.form(site.id)}
                            className="grid max-w-xl gap-4"
                        >
                        {({ errors, processing }) => (
                            <>
                                {settings.github.connected && (
                                    <div className="rounded-lg border p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="grid gap-1">
                                                <p className="text-sm font-medium">
                                                    GitHub App
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Connected as{' '}
                                                    {
                                                        settings.github
                                                            .account_login
                                                    }
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setUseManualRepository(
                                                        (previous) => !previous,
                                                    )
                                                }
                                            >
                                                {useManualRepository
                                                    ? 'Use GitHub picker'
                                                    : 'Use manual URL'}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {settings.github.connected &&
                                !useManualRepository ? (
                                    <>
                                        <Field
                                            htmlFor="github_repository"
                                            label="Repository"
                                            error={errors.github_repository}
                                        >
                                            <SearchableCombobox
                                                id="github_repository"
                                                value={selectedRepository}
                                                onValueChange={
                                                    handleRepositoryChange
                                                }
                                                options={repositoryOptions}
                                                loading={repoLoading}
                                                disabled={repoLoading}
                                                mono
                                                placeholder={
                                                    repoLoading
                                                        ? 'Loading repositories…'
                                                        : 'Search repositories…'
                                                }
                                                emptyMessage="No repositories found"
                                            />
                                            <input
                                                type="hidden"
                                                name="github_repository"
                                                value={selectedRepository}
                                            />
                                            <input
                                                type="hidden"
                                                name="github_repo_id"
                                                value={selectedRepoId ?? ''}
                                            />
                                        </Field>

                                        <Field
                                            htmlFor="repository_branch"
                                            label="Branch"
                                            error={errors.repository_branch}
                                        >
                                            <SearchableCombobox
                                                id="repository_branch"
                                                value={repositoryBranch}
                                                onValueChange={
                                                    setRepositoryBranch
                                                }
                                                options={branchOptions}
                                                loading={branchLoading}
                                                disabled={
                                                    branchLoading ||
                                                    !selectedRepository.includes(
                                                        '/',
                                                    )
                                                }
                                                mono
                                                placeholder={
                                                    branchLoading
                                                        ? 'Loading branches…'
                                                        : 'Search branches…'
                                                }
                                                emptyMessage="No branches found"
                                            />
                                            <input
                                                type="hidden"
                                                name="repository_branch"
                                                value={repositoryBranch}
                                            />
                                        </Field>

                                        <input
                                            type="hidden"
                                            name="repository"
                                            value={selectedRepository}
                                        />
                                        <input
                                            type="hidden"
                                            name="repository_provider"
                                            value="github"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="repository">
                                                Git repository URL
                                            </Label>
                                            <Input
                                                id="repository"
                                                name="repository"
                                                defaultValue={
                                                    settings.repository ?? ''
                                                }
                                                placeholder="git@github.com:org/app.git"
                                                autoComplete="off"
                                            />
                                            <InputError
                                                message={errors.repository}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="repository_branch">
                                                Branch
                                            </Label>
                                            <Input
                                                id="repository_branch"
                                                name="repository_branch"
                                                defaultValue={
                                                    settings.repository_branch
                                                }
                                                autoComplete="off"
                                            />
                                            <InputError
                                                message={
                                                    errors.repository_branch
                                                }
                                            />
                                        </div>

                                        <input
                                            type="hidden"
                                            name="repository_provider"
                                            value={settings.repository_provider}
                                        />
                                    </>
                                )}

                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="auto_deploy"
                                        checked={autoDeploy}
                                        onCheckedChange={(checked) =>
                                            setAutoDeploy(checked === true)
                                        }
                                    />
                                    <input
                                        type="hidden"
                                        name="auto_deploy"
                                        value={autoDeploy ? '1' : '0'}
                                    />
                                    <div className="grid gap-1">
                                        <Label htmlFor="auto_deploy">
                                            Auto deploy
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically deploy when the remote
                                            branch changes.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="deploy_trigger">
                                        Deploy trigger
                                    </Label>
                                    <Select
                                        value={deployTrigger}
                                        onValueChange={setDeployTrigger}
                                    >
                                        <SelectTrigger id="deploy_trigger">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">
                                                Manual only
                                            </SelectItem>
                                            <SelectItem value="poll">
                                                Poll repository
                                            </SelectItem>
                                            <SelectItem value="webhook">
                                                Webhook (GitHub)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <input
                                        type="hidden"
                                        name="deploy_trigger"
                                        value={deployTrigger}
                                    />
                                    <InputError
                                        message={errors.deploy_trigger}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="poll_interval_seconds">
                                        Poll interval (seconds)
                                    </Label>
                                    <Input
                                        id="poll_interval_seconds"
                                        name="poll_interval_seconds"
                                        type="number"
                                        min={30}
                                        max={3600}
                                        step={30}
                                        value={pollIntervalSeconds}
                                        onChange={(event) =>
                                            setPollIntervalSeconds(
                                                event.target.value,
                                            )
                                        }
                                        placeholder={`Panel default · ${settings.default_poll_interval_seconds}s`}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        Leave blank to use the panel default (
                                        {settings.default_poll_interval_seconds}
                                        s). Used when deploy trigger is poll.
                                    </p>
                                    <InputError
                                        message={errors.poll_interval_seconds}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-fit"
                                >
                                    <Save className="size-3.5" />
                                    Save deploy settings
                                </Button>
                            </>
                        )}
                    </Form>
                    </Panel>

                    <Panel
                        eyebrow="site // access"
                        title="SSH deploy key"
                        description="Generate a key for private Git repositories over SSH."
                        icon={Key}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            {!settings.deploy_key_public ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.post(
                                            generateDeployKey.url(site.id),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Generate key
                                </Button>
                            ) : null}
                        </div>
                        {settings.deploy_key_public ? (
                            <pre className="mt-4 overflow-x-auto rounded-xl border border-[#E8EEF3] bg-[#F5F8FA] p-4 font-mono text-xs dark:border-[#263647] dark:bg-[#05131E]/40">
                                {settings.deploy_key_public}
                            </pre>
                        ) : (
                            <p className="text-sm text-fg-muted">
                                No deploy key generated yet.
                            </p>
                        )}
                    </Panel>
                </>
            }
            sidebar={
                <>
                    <div className="rounded-2xl border border-[#E8EEF3]/90 bg-white/85 p-4 shadow-[0_8px_30px_rgba(5,19,30,0.04)] backdrop-blur-md dark:border-[#263647] dark:bg-[#1C2D3F]/75">
                        <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-[#06C8E0] uppercase">
                            Site profile
                        </p>
                        <SiteMetaBadges site={site} layout="stack" className="mb-4" />
                        <SpecList
                            columns={1}
                            items={[
                                {
                                    label: 'Repository',
                                    value: site.repository_connected
                                        ? `${site.repository}:${site.repository_branch}`
                                        : 'Not connected',
                                },
                                {
                                    label: 'Auto deploy',
                                    value: settings.auto_deploy ? 'On' : 'Off',
                                },
                                {
                                    label: 'Deploy trigger',
                                    value: settings.deploy_trigger,
                                },
                                ...(site.type === 'laravel' &&
                                site.database_driver
                                    ? [
                                          {
                                              label: 'Database',
                                              value:
                                                  site.database_driver ===
                                                  'sqlite'
                                                      ? 'SQLite'
                                                      : 'MySQL',
                                          },
                                      ]
                                    : []),
                                ...(site.type === 'laravel'
                                    ? [
                                          {
                                              label: 'Redis',
                                              value: site.redis_enabled
                                                  ? 'Enabled'
                                                  : 'Disabled',
                                          },
                                      ]
                                    : []),
                            ]}
                        />
                    </div>

                    <ForgeDetailsSection title="Paths">
                        <ForgeDetailRow label="Site" value={site.name} mono />
                        <ForgeDetailRow
                            label="Root"
                            value={site.path}
                            mono
                            copyable
                        />
                        <ForgeDetailRow
                            label="Web directory"
                            value={site.web_directory}
                            mono
                        />
                    </ForgeDetailsSection>
                </>
            }
        />
    );
}

/**
 * Document root, SPA fallback and upload ceiling.
 *
 * Editable after creation because the right answer depends on the framework's
 * build output — Vite writes dist/, Next's export writes out/, CRA writes
 * build/ — and guessing wrong otherwise means recreating the site.
 */
function ServingPanel({ site }: { site: SiteDetail }) {
    const presets =
        site.type === 'laravel'
            ? ['/public']
            : ['/dist', '/build', '/out', '/public', '/'];

    const [webDirectory, setWebDirectory] = useState(site.web_directory);
    const [spaFallback, setSpaFallback] = useState(site.spa_fallback);

    return (
        <Panel
            eyebrow="site // serving"
            title="How Nginx serves this site"
            description={
                site.serves_from_disk
                    ? 'Files are served straight from disk. The document root is created if it does not exist yet.'
                    : 'This site is reverse-proxied to a local port, so it has no document root.'
            }
        >
            <Form
                action={updateServing(site.id)}
                options={{ preserveScroll: true }}
            >
                {({ processing, errors }) => (
                    <div className="space-y-5">
                        {site.serves_from_disk && (
                            <>
                                <Field
                                    htmlFor="web_directory"
                                    label="Document root"
                                    error={errors.web_directory}
                                    help={`Relative to ${site.path}`}
                                >
                                    <Input
                                        id="web_directory"
                                        name="web_directory"
                                        mono
                                        spellCheck={false}
                                        value={webDirectory}
                                        onChange={(event) =>
                                            setWebDirectory(event.target.value)
                                        }
                                    />
                                </Field>

                                <div className="flex flex-wrap gap-1.5">
                                    {presets.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() =>
                                                setWebDirectory(preset)
                                            }
                                            className={cn(
                                                'rounded-sm border px-2 py-1 font-mono text-[12px] leading-[18px] transition-colors',
                                                webDirectory === preset
                                                    ? 'border-border-brand bg-brand-subtle text-fg-brand'
                                                    : 'border-[var(--bc-border-default)] text-fg-muted hover:border-border-hover',
                                            )}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>

                                <label className="flex items-start gap-2.5">
                                    <input
                                        type="checkbox"
                                        name="spa_fallback"
                                        value="1"
                                        checked={spaFallback}
                                        onChange={(event) =>
                                            setSpaFallback(event.target.checked)
                                        }
                                        className="mt-1 size-3.5 accent-[var(--bc-bg-brand)]"
                                    />
                                    <span>
                                        <span className="block text-[14px] leading-5 font-medium text-fg">
                                            SPA fallback
                                        </span>
                                        <span className="block text-[13px] leading-5 text-fg-muted">
                                            Serve index.html for unknown paths,
                                            so client-side routes survive a
                                            refresh.
                                        </span>
                                    </span>
                                </label>
                            </>
                        )}

                        <Field
                            htmlFor="client_max_body_size"
                            label="Max upload size"
                            error={errors.client_max_body_size}
                            help="nginx client_max_body_size — e.g. 100M, 512k, 1G."
                        >
                            <Input
                                id="client_max_body_size"
                                name="client_max_body_size"
                                mono
                                defaultValue={
                                    site.client_max_body_size ?? '100M'
                                }
                            />
                        </Field>

                        <div className="flex items-center gap-3">
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={processing}
                            >
                                {processing
                                    ? 'Saving…'
                                    : 'Save serving settings'}
                            </Button>
                            {site.nginx_customized && (
                                <p className="text-[13px] leading-5 text-fg-warning">
                                    This vhost is hand-edited — Beacon will not
                                    regenerate it.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </Form>
        </Panel>
    );
}

function IsolationTab({ site }: { site: SiteDetail }) {
    const [openBasedir, setOpenBasedir] = useState(site.open_basedir);
    const [strictFunctions, setStrictFunctions] = useState(
        site.strict_functions,
    );

    return (
        <ForgePageLayout
            main={
                <>
                    <StatCluster
                        stats={[
                            {
                                label: 'open_basedir',
                                value: openBasedir ? 'Enabled' : 'Off',
                                tone: openBasedir ? 'success' : 'default',
                                hint: 'Restricts PHP file access',
                            },
                            {
                                label: 'Strict functions',
                                value: strictFunctions ? 'Enabled' : 'Off',
                                tone: strictFunctions ? 'success' : 'default',
                                hint: 'Blocks dangerous PHP functions',
                            },
                            {
                                label: 'Upload limit',
                                value: site.client_max_body_size ?? '100M',
                            },
                            {
                                label: 'Web root',
                                value: site.web_directory,
                            },
                        ]}
                    />

                    <Panel
                        eyebrow="site // isolation"
                        title="PHP sandbox"
                        description="Harden the FPM pool for this site without affecting other sites on the server."
                        icon={Lock}
                    >
                        <Form
                            {...updateIsolation.form(site.id)}
                            className="space-y-6"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="flex gap-3 rounded-xl border border-[#E8EEF3] bg-white/70 p-4 dark:border-[#263647] dark:bg-[#1C2D3F]/50">
                                            <ToggleSwitch
                                                id="open_basedir"
                                                checked={openBasedir}
                                                onCheckedChange={setOpenBasedir}
                                            />
                                            <input
                                                type="hidden"
                                                name="open_basedir"
                                                value={openBasedir ? '1' : '0'}
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-fg">
                                                    open_basedir
                                                </span>
                                                <span className="mt-1 block text-sm text-fg-muted">
                                                    Limit file reads to the site
                                                    tree and configured extra paths.
                                                </span>
                                            </span>
                                        </label>

                                        <label className="flex gap-3 rounded-xl border border-[#E8EEF3] bg-white/70 p-4 dark:border-[#263647] dark:bg-[#1C2D3F]/50">
                                            <ToggleSwitch
                                                id="strict_functions"
                                                checked={strictFunctions}
                                                onCheckedChange={
                                                    setStrictFunctions
                                                }
                                            />
                                            <input
                                                type="hidden"
                                                name="strict_functions"
                                                value={
                                                    strictFunctions ? '1' : '0'
                                                }
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-fg">
                                                    Strict disabled functions
                                                </span>
                                                <span className="mt-1 block text-sm text-fg-muted">
                                                    Disable exec, shell, and other
                                                    high-risk PHP functions in this
                                                    pool.
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    <InputError message={errors.open_basedir} />
                                    <InputError message={errors.strict_functions} />

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={processing}
                                        className="w-fit"
                                    >
                                        <Save className="size-3.5" />
                                        Save isolation policy
                                    </Button>
                                </>
                            )}
                        </Form>
                    </Panel>

                    <ServingPanel site={site} />
                </>
            }
            sidebar={
                <>
                    <div className="rounded-2xl border border-[#E8EEF3]/90 bg-white/85 p-4 shadow-[0_8px_30px_rgba(5,19,30,0.04)] backdrop-blur-md dark:border-[#263647] dark:bg-[#1C2D3F]/75">
                        <SiteMetaBadges site={site} layout="stack" className="mb-4" />
                    </div>

                    <ForgeDetailsSection title="Policy summary">
                        <ForgeDetailRow
                            label="Site path"
                            value={site.path}
                            mono
                            copyable
                        />
                        <ForgeDetailRow
                            label="Nginx customized"
                            value={site.nginx_customized ? 'Yes' : 'No'}
                        />
                        <ForgeDetailRow
                            label="SPA fallback"
                            value={site.spa_fallback ? 'On' : 'Off'}
                        />
                        {site.open_basedir_extra_paths.length > 0 ? (
                            <ForgeDetailRow
                                label="Extra paths"
                                value={site.open_basedir_extra_paths.join(', ')}
                                mono
                            />
                        ) : null}
                    </ForgeDetailsSection>
                </>
            }
        />
    );
}

function DeploymentsTab({
    site,
    deployments,
    deployScript,
    deployEnvReference,
}: {
    site: SiteDetail;
    deployments: DeploymentRow[];
    deployScript: string;
    deployEnvReference: EnvReferenceRow[];
}) {
    const scriptForm = useForm({
        deploy_script: deployScript,
    });

    return (
        <ForgePageContent>
            <ForgeDeploymentsSection
                siteId={site.id}
                deployments={deployments}
                linkToTab={false}
            />

            <ForgeFormCard
                title="Deploy script"
                description="Runs as the site user after each clone. Restart workers at the end of the script."
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        scriptForm.patch(updateDeployScript.url(site.id), {
                            preserveScroll: true,
                        });
                    }}
                    className="flex flex-col gap-4"
                >
                    <CodeEditor
                        value={scriptForm.data.deploy_script}
                        onChange={(value) =>
                            scriptForm.setData('deploy_script', value)
                        }
                        language="bash"
                        rows={16}
                    />
                    <InputError message={scriptForm.errors.deploy_script} />
                    <Button
                        type="submit"
                        disabled={scriptForm.processing}
                        className="w-fit"
                    >
                        <Save className="size-3.5" />
                        Save script
                    </Button>
                    <DeployScriptEnvReference variables={deployEnvReference} />
                </form>
            </ForgeFormCard>
        </ForgePageContent>
    );
}

function SupervisorTab({
    site,
    processes,
}: {
    site: SiteDetail;
    processes: SupervisorProcessRow[];
    runtimeOptions: RuntimeOptionsPayload | null;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [processKind, setProcessKind] = useState<'queue_worker' | 'custom'>(
        defaultSupervisorProcessKind(site.type),
    );
    const [name, setName] = useState('queue');
    const [connection, setConnection] = useState('redis');
    const [queue, setQueue] = useState('default');
    const [numprocs, setNumprocs] = useState('1');
    const [sleep, setSleep] = useState('3');
    const [tries, setTries] = useState('3');
    const [jobTimeout, setJobTimeout] = useState('60');
    const [command, setCommand] = useState(() =>
        defaultSupervisorCommand(site),
    );
    const [processNameError, setProcessNameError] = useState<string>();
    const [commandError, setCommandError] = useState<string>();

    const managedProcesses = processes.filter((process) => !process.is_system);
    const supervisorFormValid =
        supervisorProcessNameError(name) === undefined &&
        (processKind !== 'custom' ||
            requiredTextError(command, 'a command', 2000) === undefined);

    const php = phpBinary(site);
    const queuePreview = `${php} artisan queue:work ${connection} --queue=${queue} --sleep=${sleep} --tries=${tries} --timeout=${jobTimeout}`;

    return (
        <ForgePageContent>
            <ForgeDividedCard
                title="Background processes"
                action={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="size-3.5" />
                                Add background process
                            </Button>
                        </DialogTrigger>
                        <DialogContent size="md">
                            <DialogHeader
                                tone="brand"
                                eyebrow="Supervisor"
                                icon={<Cog className="size-5" />}
                            >
                                <DialogTitle>New background process</DialogTitle>
                                <DialogDescription>
                                    Background processes are managed with
                                    Supervisor and restart automatically if they
                                    crash.
                                </DialogDescription>
                            </DialogHeader>
                            <Form
                                {...storeSupervisorProcess.form(site.id)}
                                className="contents"
                                onSuccess={() => setDialogOpen(false)}
                                onSubmit={(event) => {
                                    const nameValidationError =
                                        supervisorProcessNameError(name);
                                    const commandValidationError =
                                        processKind === 'custom'
                                            ? requiredTextError(
                                                  command,
                                                  'a command',
                                                  2000,
                                              )
                                            : undefined;

                                    setProcessNameError(nameValidationError);
                                    setCommandError(commandValidationError);

                                    if (
                                        nameValidationError ||
                                        commandValidationError
                                    ) {
                                        event.preventDefault();
                                    }
                                }}
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <DialogBody className="space-y-4">
                                        <input
                                            type="hidden"
                                            name="kind"
                                            value={processKind}
                                        />

                                        <Field
                                            htmlFor="process_name"
                                            label="Name"
                                            help="Add a custom display name for the background process."
                                            error={
                                                processNameError ?? errors.name
                                            }
                                        >
                                            <Input
                                                id="process_name"
                                                name="name"
                                                value={name}
                                                onChange={(event) => {
                                                    setName(event.target.value);
                                                    setProcessNameError(
                                                        undefined,
                                                    );
                                                }}
                                                placeholder="queue"
                                            />
                                        </Field>

                                        <ForgeFormTabs
                                            tabs={supervisorProcessTabOptions(
                                                site.type,
                                            )}
                                            value={processKind}
                                            onChange={(value) =>
                                                setProcessKind(
                                                    value as
                                                        | 'queue_worker'
                                                        | 'custom',
                                                )
                                            }
                                        />

                                        {processKind === 'queue_worker' ? (
                                            <div className="overflow-hidden rounded-md border border-[var(--bc-border-default)]">
                                                <ForgeFormRows className="rounded-none border-0">
                                                    <ForgeFormRow
                                                        label="connection"
                                                        htmlFor="connection"
                                                    >
                                                        <Input
                                                            id="connection"
                                                            name="connection"
                                                            value={connection}
                                                            onChange={(event) =>
                                                                setConnection(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>

                                                    <ForgeFormRow
                                                        label="queue"
                                                        htmlFor="queue"
                                                    >
                                                        <Input
                                                            id="queue"
                                                            name="queue"
                                                            value={queue}
                                                            onChange={(event) =>
                                                                setQueue(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>

                                                    <ForgeFormRow
                                                        label="processes"
                                                        htmlFor="numprocs"
                                                    >
                                                        <Input
                                                            id="numprocs"
                                                            name="numprocs"
                                                            type="number"
                                                            min={1}
                                                            value={numprocs}
                                                            onChange={(event) =>
                                                                setNumprocs(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>

                                                    <ForgeFormRow
                                                        label="sleep"
                                                        htmlFor="sleep"
                                                    >
                                                        <Input
                                                            id="sleep"
                                                            name="sleep"
                                                            type="number"
                                                            min={1}
                                                            value={sleep}
                                                            onChange={(event) =>
                                                                setSleep(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>

                                                    <ForgeFormRow
                                                        label="tries"
                                                        htmlFor="tries"
                                                    >
                                                        <Input
                                                            id="tries"
                                                            name="tries"
                                                            type="number"
                                                            min={1}
                                                            value={tries}
                                                            onChange={(event) =>
                                                                setTries(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>

                                                    <ForgeFormRow
                                                        label="timeout"
                                                        htmlFor="job_timeout"
                                                    >
                                                        <Input
                                                            id="job_timeout"
                                                            name="job_timeout"
                                                            type="number"
                                                            min={30}
                                                            value={jobTimeout}
                                                            onChange={(event) =>
                                                                setJobTimeout(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </ForgeFormRow>
                                                </ForgeFormRows>

                                                <ForgeFormPreview>
                                                    {queuePreview}
                                                </ForgeFormPreview>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <Field
                                                    htmlFor="custom_command"
                                                    label="Command"
                                                    error={
                                                        commandError ??
                                                        errors.command
                                                    }
                                                    help={`Runs in ${site.path} as the beacon user.`}
                                                >
                                                    <Input
                                                        id="custom_command"
                                                        name="command"
                                                        mono
                                                        value={command}
                                                        onChange={(event) => {
                                                            setCommand(
                                                                event.target
                                                                    .value,
                                                            );
                                                            setCommandError(
                                                                undefined,
                                                            );
                                                        }}
                                                    />
                                                </Field>
                                            </div>
                                        )}

                                        <InputError message={errors.supervisor} />
                                        </DialogBody>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    Cancel
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                type="submit"
                                                disabled={
                                                    processing ||
                                                    !supervisorFormValid
                                                }
                                            >
                                                Create background process
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                }
            >
                {managedProcesses.length === 0 ? (
                    <ForgeListRow className="justify-center py-10">
                        <ForgeEmptyState
                            icon={Cog}
                            title="No background processes yet"
                            description="Get started and create your first background process."
                            className="border-0 bg-transparent p-0 shadow-none"
                            action={
                                <Button
                                    size="sm"
                                    onClick={() => setDialogOpen(true)}
                                >
                                    <Plus className="size-3.5" />
                                    Add background process
                                </Button>
                            }
                        />
                    </ForgeListRow>
                ) : (
                    managedProcesses.map((process) => (
                        <ForgeListRow
                            key={process.id}
                            className="flex-wrap justify-between"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    {process.name}
                                </p>
                                <p className="font-mono text-xs text-[#64748b]">
                                    {process.kind === 'queue_worker'
                                        ? `queue:work · ${process.queue ?? 'default'}`
                                        : process.program_name}
                                </p>
                            </div>
                            <ForgeActionGroup>
                                <StatusBadge
                                    status={
                                        process.status === 'running'
                                            ? 'success'
                                            : process.status === 'failed'
                                              ? 'failed'
                                              : 'stopped'
                                    }
                                    label={process.status}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.post(
                                            restartSupervisorProcess.url({
                                                site: site.id,
                                                process: process.id,
                                            }),
                                            {},
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Restart
                                </Button>
                                <ConfirmDialog
                                    trigger={
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    }
                                    title="Remove background process?"
                                    description="This deletes the supervisor program and its config."
                                    confirmLabel="Remove"
                                    destructive
                                    onConfirm={() =>
                                        router.delete(
                                            destroySupervisorProcess.url({
                                                site: site.id,
                                                process: process.id,
                                            }),
                                            { preserveScroll: true },
                                        )
                                    }
                                />
                            </ForgeActionGroup>
                        </ForgeListRow>
                    ))
                )}
            </ForgeDividedCard>
        </ForgePageContent>
    );
}

const CRON_FREQUENCY_PRESETS = {
    minutely: { label: 'Every minute', expression: '* * * * *' },
    hourly: { label: 'Hourly', expression: '0 * * * *' },
    nightly: { label: 'Nightly', expression: '0 0 * * *' },
    weekly: { label: 'Weekly', expression: '0 0 * * 0' },
    monthly: { label: 'Monthly', expression: '0 0 1 * *' },
    custom: { label: 'Custom frequency', expression: '' },
} as const;

type CronFrequencyPreset = keyof typeof CRON_FREQUENCY_PRESETS;

function CronTab({ site, jobs }: { site: SiteDetail; jobs: CronJobRow[] }) {
    const scheduler = jobs.find((job) => job.is_laravel_scheduler);
    const customJobs = jobs.filter((job) => !job.is_laravel_scheduler);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [frequency, setFrequency] = useState<CronFrequencyPreset>('weekly');
    const [expression, setExpression] = useState<string>(
        CRON_FREQUENCY_PRESETS.weekly.expression,
    );
    const defaultCommand = defaultCronCommand(site);
    const [cronName, setCronName] = useState('');
    const [cronCommand, setCronCommand] = useState(defaultCommand);
    const [cronNameError, setCronNameError] = useState<string>();
    const [cronCommandError, setCronCommandError] = useState<string>();
    const [cronExpressionError, setCronExpressionError] = useState<string>();

    useEffect(() => {
        if (!dialogOpen) {
            return;
        }

        setCronName('');
        setCronCommand(defaultCommand);
        setCronNameError(undefined);
        setCronCommandError(undefined);
        setCronExpressionError(undefined);
        setFrequency('weekly');
        setExpression(CRON_FREQUENCY_PRESETS.weekly.expression);
    }, [dialogOpen, defaultCommand]);

    const cronFormValid =
        requiredTextError(cronName, 'a name', 128) === undefined &&
        requiredTextError(cronCommand, 'a command', 2000) === undefined &&
        requiredTextError(expression, 'a cron expression', 128) === undefined;

    return (
        <ForgePageContent>
            {siteHasLaravelScheduler(site.type) && (
                <ForgeDividedCard title="Scheduler">
                    <ForgeListRow className="flex-wrap justify-between gap-4">
                        <div className="min-w-0">
                            <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                Laravel scheduler
                            </p>
                            <p className="text-sm text-[#64748b]">
                                Runs{' '}
                                <code className="text-xs">schedule:run</code>{' '}
                                every minute for this site.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                router.post(
                                    toggleCronScheduler.url(site.id),
                                    {
                                        enabled: !(scheduler?.enabled ?? false),
                                    },
                                    { preserveScroll: true },
                                )
                            }
                        >
                            {scheduler?.enabled ? 'Disable' : 'Enable'} scheduler
                        </Button>
                    </ForgeListRow>
                </ForgeDividedCard>
            )}

            <ForgeDividedCard
                title="Scheduled jobs"
                action={
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <Plus className="size-3.5" />
                                Add scheduled job
                            </Button>
                        </DialogTrigger>
                        <DialogContent size="md">
                            <DialogHeader
                                tone="brand"
                                eyebrow="Cron"
                                icon={<Clock className="size-5" />}
                            >
                                <DialogTitle>New scheduled job</DialogTitle>
                                <DialogDescription>
                                    Create a cron job linked to{' '}
                                    <span className="font-medium text-base-content">
                                        {site.name}
                                    </span>
                                    . Commands should use fully qualified paths.
                                </DialogDescription>
                            </DialogHeader>
                            <Form
                                {...storeCronJob.form(site.id)}
                                className="contents"
                                onSuccess={() => setDialogOpen(false)}
                                onSubmit={(event) => {
                                    const nameValidationError = requiredTextError(
                                        cronName,
                                        'a name',
                                        128,
                                    );
                                    const commandValidationError =
                                        requiredTextError(
                                            cronCommand,
                                            'a command',
                                            2000,
                                        );
                                    const expressionValidationError =
                                        requiredTextError(
                                            expression,
                                            'a cron expression',
                                            128,
                                        );

                                    setCronNameError(nameValidationError);
                                    setCronCommandError(commandValidationError);
                                    setCronExpressionError(
                                        expressionValidationError,
                                    );

                                    if (
                                        nameValidationError ||
                                        commandValidationError ||
                                        expressionValidationError
                                    ) {
                                        event.preventDefault();
                                    }
                                }}
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <DialogBody className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="cron_name">Name</Label>
                                            <Input
                                                id="cron_name"
                                                name="name"
                                                placeholder="My scheduled job"
                                                value={cronName}
                                                onChange={(event) => {
                                                    setCronName(
                                                        event.target.value,
                                                    );
                                                    setCronNameError(undefined);
                                                }}
                                            />
                                            <InputError message={cronNameError} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="cron_command">
                                                Command
                                            </Label>
                                            <Input
                                                id="cron_command"
                                                name="command"
                                                value={cronCommand}
                                                onChange={(event) => {
                                                    setCronCommand(
                                                        event.target.value,
                                                    );
                                                    setCronCommandError(
                                                        undefined,
                                                    );
                                                }}
                                                className="font-mono text-sm"
                                            />
                                            <InputError
                                                message={cronCommandError}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="cron_frequency">
                                                Frequency
                                            </Label>
                                            <Select
                                                value={frequency}
                                                onValueChange={(value) => {
                                                    const preset =
                                                        value as CronFrequencyPreset;
                                                    setFrequency(preset);
                                                    if (preset !== 'custom') {
                                                        setExpression(
                                                            CRON_FREQUENCY_PRESETS[
                                                                preset
                                                            ].expression,
                                                        );
                                                    }
                                                }}
                                            >
                                                <SelectTrigger id="cron_frequency">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(
                                                        CRON_FREQUENCY_PRESETS,
                                                    ).map(([key, preset]) => (
                                                        <SelectItem
                                                            key={key}
                                                            value={key}
                                                        >
                                                            {preset.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <input
                                                type="hidden"
                                                name="frequency_preset"
                                                value={frequency}
                                            />
                                        </div>
                                        {frequency === 'custom' ? (
                                            <div className="grid gap-2">
                                                <Label htmlFor="cron_expression">
                                                    Cron expression
                                                </Label>
                                                <Input
                                                    id="cron_expression"
                                                    name="expression"
                                                    value={expression}
                                                    onChange={(event) => {
                                                        setExpression(
                                                            event.target.value,
                                                        );
                                                        setCronExpressionError(
                                                            undefined,
                                                        );
                                                    }}
                                                    placeholder="0 3 * * *"
                                                    className="font-mono text-sm"
                                                />
                                                <InputError
                                                    message={cronExpressionError}
                                                />
                                            </div>
                                        ) : (
                                            <input
                                                type="hidden"
                                                name="expression"
                                                value={expression}
                                            />
                                        )}
                                        <InputError message={errors.cron} />
                                        </DialogBody>
                                        <DialogFooter>
                                            <DialogClose asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                >
                                                    Cancel
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                type="submit"
                                                disabled={
                                                    processing || !cronFormValid
                                                }
                                            >
                                                Create scheduled job
                                            </Button>
                                        </DialogFooter>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                }
            >
                {customJobs.length === 0 ? (
                    <ForgeListRow className="justify-center py-10">
                        <ForgeEmptyState
                            icon={Clock}
                            title="No scheduled jobs yet"
                            description="Add custom cron jobs for backups, cleanups, or other recurring tasks."
                            className="border-0 bg-transparent p-0 shadow-none"
                            action={
                                <Button
                                    size="sm"
                                    onClick={() => setDialogOpen(true)}
                                >
                                    <Plus className="size-3.5" />
                                    Add scheduled job
                                </Button>
                            }
                        />
                    </ForgeListRow>
                ) : (
                    customJobs.map((job) => (
                        <ForgeListRow
                            key={job.id}
                            className="flex-wrap items-start justify-between gap-3"
                        >
                            <div className="min-w-0">
                                <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    {job.name}
                                </p>
                                <p className="font-mono text-xs text-[#64748b]">
                                    {job.expression}
                                    {job.frequency_preset
                                        ? ` · ${CRON_FREQUENCY_PRESETS[job.frequency_preset as CronFrequencyPreset]?.label ?? job.frequency_preset}`
                                        : ''}
                                </p>
                                <p className="mt-1 truncate font-mono text-xs text-[#0f172a] dark:text-[#f8fafc]">
                                    {job.command}
                                </p>
                            </div>
                            <ConfirmDialog
                                trigger={
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                }
                                title="Remove scheduled job?"
                                description="This removes the job from the managed crontab block."
                                confirmLabel="Remove"
                                destructive
                                onConfirm={() =>
                                    router.delete(
                                        destroyCronJob.url({
                                            site: site.id,
                                            cronJob: job.id,
                                        }),
                                        { preserveScroll: true },
                                    )
                                }
                            />
                        </ForgeListRow>
                    ))
                )}
            </ForgeDividedCard>
        </ForgePageContent>
    );
}

function EnvironmentTab({
    site,
    environment,
}: {
    site: SiteDetail;
    environment: EnvironmentPayload;
}) {
    const [revealed, setRevealed] = useState(false);
    const form = useForm({
        contents: environment.contents,
        env_cache_on_save: environment.env_cache_on_save,
    });
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };

    useEffect(() => {
        form.setData({
            contents: environment.contents,
            env_cache_on_save: environment.env_cache_on_save,
        });
    }, [environment.contents, environment.env_cache_on_save]);

    return (
        <ForgePageContent>
            <ForgeFormCard
                title="Environment"
                description={
                    site.type === 'laravel'
                        ? 'Below you may edit the .env file for your application. If the application is uninstalled, the environment file will also be removed.'
                        : 'Edit the server .env file for this site. Next.js and Nuxt apps usually keep secrets in .env.local locally — copy those values here (Beacon writes .env on the server, not .env.local).'
                }
            >
                <div className="space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                            Environment variables
                        </h3>
                        <p className="text-sm text-[#64748b]">
                            Your application&apos;s environment variables.
                        </p>
                    </div>

                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.patch(updateEnvironment.url(site.id), {
                                preserveScroll: true,
                            });
                        }}
                    >
                        {!revealed ? (
                            <div className="relative overflow-hidden rounded-lg border border-[#e2e8f0] dark:border-[#2e3032]">
                                <div
                                    className="pointer-events-none select-none px-4 py-16 font-mono text-sm leading-6 text-transparent blur-sm"
                                    aria-hidden="true"
                                >
                                    {environment.contents ||
                                        'APP_NAME=Example\nAPP_ENV=production\nAPP_KEY=\n'}
                                </div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 px-6 text-center dark:bg-[#1f2021]/85">
                                    <p className="text-sm text-[#64748b]">
                                        Environment variables should not be
                                        shared publicly.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setRevealed(true)}
                                    >
                                        <Eye className="size-3.5" />
                                        Reveal
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <CodeEditor
                                language="env"
                                value={form.data.contents}
                                onChange={(value) =>
                                    form.setData('contents', value)
                                }
                                rows={20}
                            />
                        )}

                        {siteHasConfigCacheOnSave(site.type) && (
                            <div className="flex items-center justify-between gap-4 border-t border-[#e2e8f0] pt-4 dark:border-[#2e3032]">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                        Cache
                                    </p>
                                    <p className="text-sm text-[#64748b]">
                                        Run{' '}
                                        <code className="rounded bg-[#f1f5f9] px-1.5 py-0.5 font-mono text-xs dark:bg-[#2e3032]">
                                            php artisan config:cache
                                        </code>{' '}
                                        after updating environment variables.
                                    </p>
                                </div>
                                <ToggleSwitch
                                    id="env_cache_on_save"
                                    checked={form.data.env_cache_on_save}
                                    onCheckedChange={(checked) =>
                                        form.setData(
                                            'env_cache_on_save',
                                            checked,
                                        )
                                    }
                                />
                            </div>
                        )}

                        <InputError message={errors.environment} />

                        {revealed && (
                            <Button
                                type="submit"
                                disabled={form.processing}
                                className="w-fit"
                            >
                                <Save className="size-3.5" />
                                Save .env
                            </Button>
                        )}
                    </form>
                </div>
            </ForgeFormCard>

            {environment.snapshots.length > 0 && (
                <ForgeDividedCard title="Snapshots">
                    {environment.snapshots.map((snapshot) => (
                        <ForgeListRow
                            key={snapshot.id}
                            className="justify-between"
                        >
                            <time
                                dateTime={snapshot.created_at ?? ''}
                                className="text-[#64748b]"
                            >
                                {snapshot.created_at
                                    ? new Date(
                                          snapshot.created_at,
                                      ).toLocaleString()
                                    : 'Unknown'}
                            </time>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                    >
                                        Compare & restore
                                    </Button>
                                </DialogTrigger>
                                <DialogContent size="xl">
                                    <DialogHeader
                                        tone="default"
                                        eyebrow="Environment"
                                        icon={
                                            <History className="size-5" />
                                        }
                                    >
                                        <DialogTitle>
                                            Environment snapshot
                                        </DialogTitle>
                                        <DialogDescription>
                                            Green lines will be added, red lines
                                            will be removed when restoring this
                                            snapshot.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogBody>
                                        <CodeDiffViewer
                                            oldValue={form.data.contents}
                                            newValue={snapshot.contents}
                                            oldTitle="Current .env"
                                            newTitle="Snapshot"
                                        />
                                    </DialogBody>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                            >
                                                Close
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                router.post(
                                                    restoreEnvironmentSnapshot.url(
                                                        {
                                                            site: site.id,
                                                            snapshot:
                                                                snapshot.id,
                                                        },
                                                    ),
                                                    {},
                                                    {
                                                        preserveScroll: true,
                                                    },
                                                )
                                            }
                                        >
                                            Restore snapshot
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </ForgeListRow>
                    ))}
                </ForgeDividedCard>
            )}
        </ForgePageContent>
    );
}

function ConsoleTab({
    site,
    commands,
    activeCommand,
}: {
    site: SiteDetail;
    commands: ConsoleCommandRow[];
    activeCommand: ConsoleCommandRow | null;
}) {
    const [command, setCommand] = useState('');
    const [viewingCommand, setViewingCommand] =
        useState<ConsoleCommandRow | null>(activeCommand);

    useEffect(() => {
        if (activeCommand !== null) {
            setViewingCommand(activeCommand);
        }
    }, [activeCommand]);

    const successCount = commands.filter((entry) => entry.status === 'success')
        .length;
    const failedCount = commands.filter(
        (entry) => entry.status === 'failed' || entry.status === 'timed_out',
    ).length;

    function rerunCommand(commandText: string): void {
        router.post(
            storeSiteCommand.url(site.id),
            { command: commandText },
            { preserveScroll: true },
        );
    }

    return (
        <ForgePageLayout
            main={
                <>
                    <Panel
                        eyebrow="site // console"
                        title="Run a command"
                        description="Commands execute as the site user in the site directory. Output streams live below."
                        icon={Terminal}
                    >
                        <Form
                            {...storeSiteCommand.form(site.id)}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <Field
                                        htmlFor="console_command"
                                        label="Command"
                                        error={errors.command}
                                    >
                                        <Input
                                            id="console_command"
                                            name="command"
                                            value={command}
                                            onChange={(event) =>
                                                setCommand(event.target.value)
                                            }
                                            placeholder={consoleCommandPlaceholder(
                                                site,
                                            )}
                                            mono
                                            autoComplete="off"
                                            className="text-sm"
                                        />
                                    </Field>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            disabled={processing}
                                        >
                                            <Play className="size-3.5" />
                                            {processing ? 'Running…' : 'Run command'}
                                        </Button>
                                        {viewingCommand &&
                                        (viewingCommand.status === 'queued' ||
                                            viewingCommand.status ===
                                                'running') ? (
                                            <StatusBadge
                                                status={deploymentStatus(
                                                    viewingCommand.status,
                                                )}
                                                label={viewingCommand.status}
                                            />
                                        ) : null}
                                    </div>
                                </>
                            )}
                        </Form>
                    </Panel>

                    {viewingCommand ? (
                        <CommandLogViewer
                            siteId={site.id}
                            command={viewingCommand}
                        />
                    ) : null}

                    <Panel
                        eyebrow="site // history"
                        title="Recent commands"
                        description={`${commands.length} command${commands.length === 1 ? '' : 's'} recorded for this site.`}
                        icon={History}
                        flush
                    >
                        {commands.length === 0 ? (
                            <div className="px-6 py-8">
                                <ForgeEmptyState
                                    icon={Terminal}
                                    title="No commands yet"
                                    description="Your command history will appear here after you run artisan, npm, or other site commands."
                                />
                            </div>
                        ) : (
                            <ul className="divide-y divide-[#E8EEF3] dark:divide-[#263647]">
                                {commands.map((entry) => (
                                    <li
                                        key={entry.uuid}
                                        className={cn(
                                            'flex flex-wrap items-center justify-between gap-3 px-6 py-3.5',
                                            viewingCommand?.uuid === entry.uuid &&
                                                'bg-[#F4F8FB] dark:bg-[#243447]',
                                        )}
                                    >
                                        <code className="min-w-0 flex-1 truncate font-mono text-xs text-[#1C2D3F] dark:text-[#E8EEF3]">
                                            {entry.command}
                                        </code>
                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            <span className="text-xs tabular-nums text-fg-muted">
                                                {formatDuration(entry.duration_ms)}
                                            </span>
                                            <StatusBadge
                                                status={deploymentStatus(
                                                    entry.status === 'timed_out'
                                                        ? 'failed'
                                                        : entry.status,
                                                )}
                                                label={entry.status}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setViewingCommand(entry)
                                                }
                                            >
                                                <Eye className="size-3.5" />
                                                View
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    rerunCommand(entry.command)
                                                }
                                            >
                                                <RotateCcw className="size-3.5" />
                                                Re-run
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </>
            }
            sidebar={
                <>
                    <div className="rounded-2xl border border-[#E8EEF3]/90 bg-white/85 p-4 shadow-[0_8px_30px_rgba(5,19,30,0.04)] backdrop-blur-md dark:border-[#263647] dark:bg-[#1C2D3F]/75">
                        <SiteMetaBadges site={site} layout="stack" className="mb-4" />
                        <SpecList
                            columns={1}
                            items={[
                                {
                                    label: 'Site user',
                                    value: site.system_user ?? 'beacon',
                                },
                                { label: 'Working directory', value: site.path },
                                {
                                    label: 'PHP',
                                    value: site.php_version
                                        ? `PHP ${site.php_version}`
                                        : '—',
                                },
                            ]}
                        />
                    </div>

                    <StatCluster
                        stats={[
                            {
                                label: 'Total runs',
                                value: commands.length,
                                tone: 'brand',
                            },
                            {
                                label: 'Succeeded',
                                value: successCount,
                                tone: 'success',
                            },
                            {
                                label: 'Failed',
                                value: failedCount,
                                tone: failedCount > 0 ? 'danger' : 'default',
                            },
                        ]}
                        className="grid-cols-1!"
                    />
                </>
            }
        />
    );
}

export default function SiteShow({
    site,
    tab,
    nginx,
    deployments,
    deployScript,
    deployEnvReference,
    activeDeployment,
    latestDeployment,
    sslCertificate,
    siteSettings,
    runtimeOptions,
    supervisorProcesses,
    cronJobs,
    environment,
    consoleCommands,
    activeCommand,
}: Props) {
    setLayoutProps({
        site,
        tab,
        breadcrumbs: [
            { title: 'Sites', href: sitesIndex() },
            {
                title: site.name,
                href: show(site.id, { query: { tab: 'overview' } }),
            },
        ],
    });

    if (tab === 'overview') {
        return (
            <>
                <Head title={`${site.name} — Overview`} />
                <OverviewTab
                    site={site}
                    deployments={deployments ?? []}
                    supervisorProcesses={supervisorProcesses ?? []}
                    cronJobs={cronJobs ?? []}
                />
            </>
        );
    }

    if (tab === 'domains' && nginx) {
        return (
            <>
                <Head title={`${site.name} — Domains`} />
                <DomainsTab site={site} nginx={nginx} />
            </>
        );
    }

    if (tab === 'nginx') {
        return null;
    }

    if (tab === 'isolation') {
        return (
            <>
                <Head title={`${site.name} — Isolation`} />
                <IsolationTab site={site} />
            </>
        );
    }

    if (
        tab === 'deployments' &&
        deployments !== null &&
        deployScript !== null &&
        deployEnvReference !== null
    ) {
        return (
            <>
                <Head title={`${site.name} — Deployments`} />
                <DeploymentsTab
                    site={site}
                    deployments={deployments}
                    deployScript={deployScript}
                    deployEnvReference={deployEnvReference}
                />
            </>
        );
    }

    if (tab === 'ssl') {
        return (
            <>
                <Head title={`${site.name} — TLS`} />
                <SslTab site={site} certificate={sslCertificate} />
            </>
        );
    }

    if (
        tab === 'settings' &&
        siteSettings !== null &&
        runtimeOptions !== null
    ) {
        return (
            <>
                <Head title={`${site.name} — Settings`} />
                <SettingsTab
                    site={site}
                    settings={siteSettings}
                    runtimeOptions={runtimeOptions}
                />
            </>
        );
    }

    if (tab === 'supervisor' && supervisorProcesses !== null) {
        return (
            <>
                <Head title={`${site.name} — Supervisor`} />
                <SupervisorTab site={site} processes={supervisorProcesses} runtimeOptions={runtimeOptions} />
            </>
        );
    }

    if (tab === 'cron' && cronJobs !== null) {
        return (
            <>
                <Head title={`${site.name} — Cron`} />
                <CronTab site={site} jobs={cronJobs} />
            </>
        );
    }

    if (tab === 'environment' && environment !== null) {
        return (
            <>
                <Head title={`${site.name} — Environment`} />
                <EnvironmentTab site={site} environment={environment} />
            </>
        );
    }

    if (tab === 'console' && consoleCommands !== null) {
        return (
            <>
                <Head title={`${site.name} — Console`} />
                <ConsoleTab
                    site={site}
                    commands={consoleCommands}
                    activeCommand={activeCommand}
                />
            </>
        );
    }

    return (
        <>
            <Head title={`${site.name} — ${tab}`} />
            <p className="text-sm text-muted-foreground">
                This tab is not available yet.
            </p>
        </>
    );
}
