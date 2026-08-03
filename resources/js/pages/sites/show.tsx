import { Form, Head, router, useForm, usePage } from '@inertiajs/react';
import { Play, RotateCcw, Save, Shield, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CodeDiffViewer } from '@/components/code-diff-viewer';
import { CodeEditor } from '@/components/code-editor';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Panel } from '@/components/console/panel';
import { DeployScriptEnvReference } from '@/components/deploy-script-env-reference';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Terminal } from '@/components/terminal';
import type { TerminalStatus } from '@/components/terminal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import { destroy, index as sitesIndex, show } from '@/routes/sites';
import {
    store as storeSiteCommand,
    log as commandLog,
} from '@/routes/sites/commands';
import {
    store as storeCronJob,
    destroy as destroyCronJob,
    scheduler as toggleCronScheduler,
} from '@/routes/sites/cron';
import { store as generateDeployKey } from '@/routes/sites/deploy-key';
import { update as updateDeployScript } from '@/routes/sites/deploy-script';
import { store as storeDeployment } from '@/routes/sites/deployments';
import { log as deploymentLog } from '@/routes/sites/deployments';
import {
    destroy as destroyDomain,
    primary as makePrimaryDomain,
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

type SiteDetail = SiteSummary & ServingFields & {
    path: string;
    web_directory: string;
    php_version: string | null;
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

function deploymentTerminalStatus(status: string): TerminalStatus {
    if (status === 'running' || status === 'queued') {
        return 'running';
    }

    if (status === 'success') {
        return 'success';
    }

    if (status === 'failed') {
        return 'failed';
    }

    return 'idle';
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

function DeploymentLogViewer({
    siteId,
    deployment,
}: {
    siteId: string;
    deployment: DeploymentRow;
}) {
    return (
        <DeploymentLogViewerContent
            key={deployment.uuid}
            siteId={siteId}
            deployment={deployment}
        />
    );
}

function DeploymentLogViewerContent({
    siteId,
    deployment,
}: {
    siteId: string;
    deployment: DeploymentRow;
}) {
    const [chunks, setChunks] = useState<string[]>([]);
    const [status, setStatus] = useState(deployment.status);
    const offsetRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        async function poll() {
            const response = await fetch(
                deploymentLog.url(
                    { site: siteId, deployment: deployment.uuid },
                    { query: { offset: offsetRef.current } },
                ),
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok || cancelled) {
                return;
            }

            const data = (await response.json()) as {
                offset: number;
                chunk: string;
                status: string;
            };

            if (data.chunk) {
                setChunks((previous) => [...previous, data.chunk]);
            }

            offsetRef.current = data.offset;
            setStatus(data.status);
        }

        void poll();

        const interval = setInterval(() => {
            if (status === 'queued' || status === 'running') {
                void poll();
            }
        }, 1000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [deployment.uuid, siteId, status]);

    return (
        <Terminal
            chunks={chunks}
            status={deploymentTerminalStatus(status)}
            title={`Deployment ${deployment.uuid.slice(0, 8)}`}
        />
    );
}

function sslStatus(status: string): Status {
    return ({
        issued: 'success',
        pending: 'pending',
        expired: 'failed',
        none: 'info',
    }[status] ?? 'info') as Status;
}

function siteStatus(status: string): Status {
    return status === 'active' ? 'success' : 'pending';
}

function OverviewTab({ site }: { site: SiteDetail }) {
    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Site details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Status
                            </span>
                            <StatusBadge
                                status={siteStatus(site.status)}
                                label={site.status}
                            />
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Type</span>
                            <span className="capitalize">{site.type}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Path</span>
                            <span className="font-mono text-xs">
                                {site.path}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Web directory
                            </span>
                            <span className="font-mono text-xs">
                                {site.web_directory}
                            </span>
                        </div>
                        {site.php_version && (
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    PHP
                                </span>
                                <span>{site.php_version}</span>
                            </div>
                        )}
                        {site.node_version && (
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Node
                                </span>
                                <span>{site.node_version}</span>
                            </div>
                        )}
                        {site.proxy_port && (
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Proxy port
                                </span>
                                <span>{site.proxy_port}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Deployment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Status
                            </span>
                            <span>{site.deployment_status}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">SSL</span>
                            <span>{site.ssl_status}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Nginx</span>
                            <span>
                                {site.nginx_customized
                                    ? 'Customized'
                                    : 'Generated'}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ConfirmDialog
                trigger={
                    <Button variant="destructive" size="sm" className="w-fit">
                        <Trash2 className="size-3.5" />
                        Delete site
                    </Button>
                }
                title={`Delete ${site.name}?`}
                description="This removes the Nginx config, PHP pool, site directory, and database record. This cannot be undone."
                confirmLabel="Delete site"
                destructive
                confirmationValue={site.name}
                onConfirm={() =>
                    router.delete(destroy.url(site.id), {
                        data: { confirmation: site.name },
                    })
                }
            />
        </div>
    );
}

function DomainsTab({ site }: { site: SiteDetail }) {
    const [redirectWww, setRedirectWww] = useState(false);
    const domainForm = useForm({
        domain: '',
        redirect_www: false,
    });

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Add domain</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            domainForm.transform((data) => ({
                                ...data,
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
                        className="grid max-w-xl gap-4"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="domain">Domain</Label>
                            <Input
                                id="domain"
                                value={domainForm.data.domain}
                                onChange={(event) =>
                                    domainForm.setData(
                                        'domain',
                                        event.target.value,
                                    )
                                }
                                placeholder="api.example.com"
                                autoComplete="off"
                            />
                            <InputError message={domainForm.errors.domain} />
                        </div>

                        <div className="flex items-start gap-3">
                            <Checkbox
                                id="redirect_www"
                                checked={redirectWww}
                                onCheckedChange={(checked) =>
                                    setRedirectWww(checked === true)
                                }
                            />
                            <div className="grid gap-1">
                                <Label htmlFor="redirect_www">
                                    Redirect www to apex
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Creates a www alias that redirects to this
                                    domain.
                                </p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={domainForm.processing}
                            className="w-fit"
                        >
                            Add domain
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Domains</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {site.domains.map((domain) => (
                        <div
                            key={domain.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                        >
                            <div className="flex flex-col gap-1">
                                <span className="font-mono">
                                    {domain.domain}
                                </span>
                                {domain.redirect_to && (
                                    <span className="text-xs text-muted-foreground">
                                        Redirects to {domain.redirect_to} (
                                        {domain.redirect_status_code ?? 301})
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {domain.is_primary ? (
                                    <span className="text-xs text-muted-foreground">
                                        Primary
                                    </span>
                                ) : (
                                    !domain.redirect_to && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                router.patch(
                                                    makePrimaryDomain.url({
                                                        site: site.id,
                                                        domain: domain.domain,
                                                    }),
                                                    {},
                                                    { preserveScroll: true },
                                                )
                                            }
                                        >
                                            Make primary
                                        </Button>
                                    )
                                )}
                                {!domain.is_primary && (
                                    <ConfirmDialog
                                        trigger={
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive"
                                            >
                                                Remove
                                            </Button>
                                        }
                                        title={`Remove ${domain.domain}?`}
                                        description="This domain will be removed from the site and Nginx will be updated."
                                        confirmLabel="Remove domain"
                                        destructive
                                        onConfirm={() =>
                                            router.delete(
                                                destroyDomain.url({
                                                    site: site.id,
                                                    domain: domain.domain,
                                                }),
                                                { preserveScroll: true },
                                            )
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function SslTab({
    site,
    certificate,
}: {
    site: SiteDetail;
    certificate: SslCertificatePayload | null;
}) {
    const issueForm = useForm({
        email: '',
    });

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">SSL status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Status</span>
                        <StatusBadge
                            status={sslStatus(site.ssl_status)}
                            label={site.ssl_status}
                        />
                    </div>
                </CardContent>
            </Card>

            {certificate ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Active certificate
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Certificate name
                            </span>
                            <span className="font-mono">
                                {certificate.lineage}
                            </span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">
                                Domains
                            </span>
                            <span className="text-right font-mono text-xs">
                                {certificate.domains.join(', ')}
                            </span>
                        </div>
                        {certificate.expires_at && (
                            <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">
                                    Expires
                                </span>
                                <span>
                                    {new Date(
                                        certificate.expires_at,
                                    ).toLocaleDateString()}{' '}
                                    ({certificate.days_remaining} days)
                                </span>
                            </div>
                        )}

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
                            title="Remove SSL certificate?"
                            description="This deletes the certificate from certbot and updates Nginx."
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
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Issue certificate
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                issueForm.post(issueSsl.url(site.id), {
                                    preserveScroll: true,
                                    onSuccess: () => issueForm.reset(),
                                });
                            }}
                            className="grid max-w-xl gap-4"
                        >
                            <p className="text-sm text-muted-foreground">
                                Request a Let&apos;s Encrypt certificate for all
                                non-redirect domains on this site.
                            </p>
                            <div className="grid gap-2">
                                <Label htmlFor="email">
                                    Let&apos;s Encrypt email
                                </Label>
                                <Input
                                    id="email"
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
                                Issue certificate
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
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
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Runtime</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            runtimeForm.patch(updateSiteRuntime.url(site.id), {
                                preserveScroll: true,
                            });
                        }}
                        className="grid max-w-xl gap-4"
                    >
                        <p className="text-sm text-muted-foreground">
                            Changing PHP regenerates the FPM pool and nginx
                            vhost, then restarts PHP-FPM and Supervisor
                            processes for this site.
                        </p>

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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Repository & deploy
                    </CardTitle>
                </CardHeader>
                <CardContent>
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
                                        <div className="grid gap-2">
                                            <Label htmlFor="github_repository">
                                                Repository
                                            </Label>
                                            <Select
                                                value={
                                                    selectedRepository ||
                                                    undefined
                                                }
                                                onValueChange={
                                                    handleRepositoryChange
                                                }
                                                disabled={repoLoading}
                                            >
                                                <SelectTrigger id="github_repository">
                                                    <SelectValue
                                                        placeholder={
                                                            repoLoading
                                                                ? 'Loading repositories…'
                                                                : 'Select a repository'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {repositories.map(
                                                        (repository) => (
                                                            <SelectItem
                                                                key={
                                                                    repository.id
                                                                }
                                                                value={
                                                                    repository.full_name
                                                                }
                                                            >
                                                                {
                                                                    repository.full_name
                                                                }
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
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
                                            <InputError
                                                message={
                                                    errors.github_repository
                                                }
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="repository_branch">
                                                Branch
                                            </Label>
                                            <Select
                                                value={repositoryBranch}
                                                onValueChange={
                                                    setRepositoryBranch
                                                }
                                                disabled={branchLoading}
                                            >
                                                <SelectTrigger id="repository_branch">
                                                    <SelectValue
                                                        placeholder={
                                                            branchLoading
                                                                ? 'Loading branches…'
                                                                : 'Select a branch'
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {visibleBranches.map(
                                                        (branch) => (
                                                            <SelectItem
                                                                key={branch}
                                                                value={branch}
                                                            >
                                                                {branch}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <input
                                                type="hidden"
                                                name="repository_branch"
                                                value={repositoryBranch}
                                            />
                                            <InputError
                                                message={
                                                    errors.repository_branch
                                                }
                                            />
                                        </div>

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

                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-fit"
                                >
                                    <Save className="size-3.5" />
                                    Save settings
                                </Button>

                                <div className="rounded-lg border p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="grid gap-1">
                                            <p className="text-sm font-medium">
                                                SSH deploy key
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Generate a key for private Git
                                                repositories over SSH.
                                            </p>
                                        </div>
                                        {!settings.deploy_key_public && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    router.post(
                                                        generateDeployKey.url(
                                                            site.id,
                                                        ),
                                                        {},
                                                        {
                                                            preserveScroll: true,
                                                        },
                                                    )
                                                }
                                            >
                                                Generate key
                                            </Button>
                                        )}
                                    </div>
                                    {settings.deploy_key_public && (
                                        <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                                            {settings.deploy_key_public}
                                        </pre>
                                    )}
                                    <InputError message={errors.deploy_key} />
                                </div>
                            </>
                        )}
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

function NginxTab({ site, nginx }: { site: SiteDetail; nginx: NginxPayload }) {
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };
    const errorLine = errors.error_line
        ? Number.parseInt(errors.error_line, 10)
        : undefined;

    const form = useForm({
        contents: nginx.contents,
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    {nginx.customized
                        ? 'This configuration has been customized and will not be overwritten automatically.'
                        : 'Generated template — edits will mark the config as customized.'}
                </p>
                <div className="flex gap-2">
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
                                { preserveScroll: true },
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
                </div>
            </div>

            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.patch(updateNginx.url(site.id), {
                        preserveScroll: true,
                    });
                }}
                className="flex flex-col gap-3"
            >
                <CodeEditor
                    value={form.data.contents}
                    onChange={(value) => form.setData('contents', value)}
                    language="nginx"
                    errorLine={errorLine}
                    rows={24}
                />
                <InputError message={form.errors.contents} />

                <div className="flex justify-end">
                    <Button type="submit" disabled={form.processing}>
                        <Save className="size-3.5" />
                        Save configuration
                    </Button>
                </div>
            </form>
        </div>
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
                                            onClick={() => setWebDirectory(preset)}
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
                                            Serve index.html for unknown paths, so
                                            client-side routes survive a refresh.
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
                                defaultValue={site.client_max_body_size ?? '100M'}
                            />
                        </Field>

                        <div className="flex items-center gap-3">
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={processing}
                            >
                                {processing ? 'Saving…' : 'Save serving settings'}
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
        <Card>
            <CardHeader>
                <CardTitle className="text-base">PHP isolation</CardTitle>
            </CardHeader>
            <CardContent>
                <Form
                    {...updateIsolation.form(site.id)}
                    className="grid max-w-xl gap-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="open_basedir"
                                    checked={openBasedir}
                                    onCheckedChange={(checked) =>
                                        setOpenBasedir(checked === true)
                                    }
                                />
                                <input
                                    type="hidden"
                                    name="open_basedir"
                                    value={openBasedir ? '1' : '0'}
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="open_basedir">
                                        Enable open_basedir
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Restrict PHP file access to the site
                                        directory and configured extra paths.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="strict_functions"
                                    checked={strictFunctions}
                                    onCheckedChange={(checked) =>
                                        setStrictFunctions(checked === true)
                                    }
                                />
                                <input
                                    type="hidden"
                                    name="strict_functions"
                                    value={strictFunctions ? '1' : '0'}
                                />
                                <div className="grid gap-1">
                                    <Label htmlFor="strict_functions">
                                        Strict disabled functions
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Disable dangerous PHP functions in the
                                        FPM pool for this site.
                                    </p>
                                </div>
                            </div>

                            <InputError message={errors.open_basedir} />
                            <InputError message={errors.strict_functions} />

                            <Button
                                type="submit"
                                disabled={processing}
                                className="w-fit"
                            >
                                Save isolation settings
                            </Button>
                        </>
                    )}
                </Form>
            </CardContent>
        </Card>
    );
}

function DeploymentsTab({
    site,
    deployments,
    deployScript,
    deployEnvReference,
    activeDeployment,
}: {
    site: SiteDetail;
    deployments: DeploymentRow[];
    deployScript: string;
    deployEnvReference: EnvReferenceRow[];
    activeDeployment: DeploymentRow | null;
}) {
    const scriptForm = useForm({
        deploy_script: deployScript,
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Run the deploy script as the site user with Beacon
                    environment variables injected.
                </p>
                <Button
                    onClick={() =>
                        router.post(
                            storeDeployment.url(site.id),
                            {},
                            {
                                preserveScroll: true,
                            },
                        )
                    }
                >
                    <Play className="size-3.5" />
                    Deploy now
                </Button>
            </div>

            {activeDeployment && (
                <DeploymentLogViewer
                    siteId={site.id}
                    deployment={activeDeployment}
                />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Deploy script</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                scriptForm.patch(
                                    updateDeployScript.url(site.id),
                                    {
                                        preserveScroll: true,
                                    },
                                );
                            }}
                            className="flex min-w-0 flex-col gap-3"
                        >
                            <CodeEditor
                                value={scriptForm.data.deploy_script}
                                onChange={(value) =>
                                    scriptForm.setData('deploy_script', value)
                                }
                                language="bash"
                                rows={14}
                            />
                            <InputError
                                message={scriptForm.errors.deploy_script}
                            />
                            <Button
                                type="submit"
                                disabled={scriptForm.processing}
                                className="w-fit"
                            >
                                <Save className="size-3.5" />
                                Save script
                            </Button>
                        </form>
                        <DeployScriptEnvReference
                            variables={deployEnvReference}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Recent deployments
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {deployments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No deployments yet.
                        </p>
                    ) : (
                        deployments.map((deployment) => (
                            <div
                                key={deployment.uuid}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                            >
                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        className="text-left font-medium hover:underline"
                                        onClick={() =>
                                            router.get(
                                                show.url(site.id, {
                                                    query: {
                                                        tab: 'deployments',
                                                        deployment:
                                                            deployment.uuid,
                                                    },
                                                }),
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        {deployment.trigger} ·{' '}
                                        {deployment.created_at
                                            ? new Date(
                                                  deployment.created_at,
                                              ).toLocaleString()
                                            : 'Unknown time'}
                                    </button>
                                    {deployment.commit_sha && (
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {deployment.commit_sha.slice(0, 7)}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">
                                        {formatDuration(deployment.duration_ms)}
                                    </span>
                                    <StatusBadge
                                        status={deploymentStatus(
                                            deployment.status,
                                        )}
                                        label={deployment.status}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SupervisorTab({
    site,
    processes,
}: {
    site: SiteDetail;
    processes: SupervisorProcessRow[];
}) {
    const [name, setName] = useState('queue');
    const [queue, setQueue] = useState('default');

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Queue workers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {processes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No supervisor processes yet.
                        </p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {processes.map((process) => (
                                <li
                                    key={process.id}
                                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {process.name}
                                        </p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {process.program_name}
                                            {process.queue
                                                ? ` · ${process.queue}`
                                                : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge
                                            status={
                                                process.status === 'running'
                                                    ? 'success'
                                                    : process.status ===
                                                        'failed'
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
                                                    restartSupervisorProcess.url(
                                                        {
                                                            site: site.id,
                                                            process: process.id,
                                                        },
                                                    ),
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
                                            title="Remove process?"
                                            description="This deletes the supervisor program and its config."
                                            confirmLabel="Remove"
                                            destructive
                                            onConfirm={() =>
                                                router.delete(
                                                    destroySupervisorProcess.url(
                                                        {
                                                            site: site.id,
                                                            process: process.id,
                                                        },
                                                    ),
                                                    { preserveScroll: true },
                                                )
                                            }
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Add queue worker
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Form
                        {...storeSupervisorProcess.form(site.id)}
                        className="grid max-w-xl gap-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="supervisor_name">
                                        Name
                                    </Label>
                                    <Input
                                        id="supervisor_name"
                                        name="name"
                                        value={name}
                                        onChange={(event) =>
                                            setName(event.target.value)
                                        }
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="supervisor_queue">
                                        Queue
                                    </Label>
                                    <Input
                                        id="supervisor_queue"
                                        name="queue"
                                        value={queue}
                                        onChange={(event) =>
                                            setQueue(event.target.value)
                                        }
                                    />
                                </div>
                                <InputError message={errors.supervisor} />
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-fit"
                                >
                                    Create worker
                                </Button>
                            </>
                        )}
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

function CronTab({ site, jobs }: { site: SiteDetail; jobs: CronJobRow[] }) {
    const scheduler = jobs.find((job) => job.is_laravel_scheduler);
    const customJobs = jobs.filter((job) => !job.is_laravel_scheduler);

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Laravel scheduler
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Runs <code className="text-xs">schedule:run</code> every
                        minute for this site.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
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
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Custom jobs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {customJobs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No custom cron jobs yet.
                        </p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {customJobs.map((job) => (
                                <li
                                    key={job.id}
                                    className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium">
                                            {job.name}
                                        </p>
                                        <p className="font-mono text-xs text-muted-foreground">
                                            {job.expression}
                                        </p>
                                        <p className="mt-1 truncate font-mono text-xs">
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
                                        title="Remove cron job?"
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
                                </li>
                            ))}
                        </ul>
                    )}

                    <Form
                        {...storeCronJob.form(site.id)}
                        className="grid max-w-xl gap-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="cron_name">Name</Label>
                                    <Input
                                        id="cron_name"
                                        name="name"
                                        placeholder="Nightly backup"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="cron_expression">
                                        Cron expression
                                    </Label>
                                    <Input
                                        id="cron_expression"
                                        name="expression"
                                        defaultValue="0 3 * * *"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="cron_command">
                                        Command
                                    </Label>
                                    <Input
                                        id="cron_command"
                                        name="command"
                                        placeholder="cd $PWD && php artisan backup:run"
                                    />
                                </div>
                                <InputError message={errors.cron} />
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-fit"
                                >
                                    Add cron job
                                </Button>
                            </>
                        )}
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

function EnvironmentTab({
    site,
    environment,
}: {
    site: SiteDetail;
    environment: EnvironmentPayload;
}) {
    const form = useForm({ contents: environment.contents });
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Site .env</CardTitle>
                </CardHeader>
                <CardContent>
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            form.patch(updateEnvironment.url(site.id), {
                                preserveScroll: true,
                            });
                        }}
                    >
                        <CodeEditor
                            language="env"
                            value={form.data.contents}
                            onChange={(value) =>
                                form.setData('contents', value)
                            }
                            rows={20}
                        />
                        <InputError message={errors.environment} />
                        <Button
                            type="submit"
                            disabled={form.processing}
                            className="w-fit"
                        >
                            <Save className="size-3.5" />
                            Save .env
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {environment.snapshots.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Snapshots</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="divide-y rounded-lg border">
                            {environment.snapshots.map((snapshot) => (
                                <li
                                    key={snapshot.id}
                                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                >
                                    <time dateTime={snapshot.created_at ?? ''}>
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
                                        <DialogContent className="max-w-4xl">
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Environment snapshot
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Green lines will be added,
                                                    red lines will be removed
                                                    when restoring this
                                                    snapshot.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <CodeDiffViewer
                                                oldValue={form.data.contents}
                                                newValue={snapshot.contents}
                                                oldTitle="Current .env"
                                                newTitle="Snapshot"
                                            />
                                            <DialogFooter>
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
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>
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
    const [command, setCommand] = useState('php artisan --version');

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Run command</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form
                        {...storeSiteCommand.form(site.id)}
                        className="grid max-w-3xl gap-4"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="console_command">
                                        Command
                                    </Label>
                                    <Input
                                        id="console_command"
                                        name="command"
                                        value={command}
                                        onChange={(event) =>
                                            setCommand(event.target.value)
                                        }
                                        className="font-mono text-sm"
                                        autoComplete="off"
                                    />
                                    <InputError message={errors.command} />
                                </div>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-fit"
                                >
                                    <Play className="size-3.5" />
                                    Run
                                </Button>
                            </>
                        )}
                    </Form>
                </CardContent>
            </Card>

            {activeCommand && (
                <CommandLogViewer siteId={site.id} command={activeCommand} />
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">History</CardTitle>
                </CardHeader>
                <CardContent>
                    {commands.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No commands run yet.
                        </p>
                    ) : (
                        <ul className="divide-y rounded-lg border">
                            {commands.map((entry) => (
                                <li
                                    key={entry.uuid}
                                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                                >
                                    <code className="truncate text-xs">
                                        {entry.command}
                                    </code>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
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
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function commandTerminalStatus(status: string): TerminalStatus {
    if (status === 'running' || status === 'queued') {
        return 'running';
    }

    if (status === 'success') {
        return 'success';
    }

    if (status === 'failed' || status === 'timed_out') {
        return 'failed';
    }

    return 'idle';
}

function CommandLogViewer({
    siteId,
    command,
}: {
    siteId: string;
    command: ConsoleCommandRow;
}) {
    return (
        <CommandLogViewerContent
            key={command.uuid}
            siteId={siteId}
            command={command}
        />
    );
}

function CommandLogViewerContent({
    siteId,
    command,
}: {
    siteId: string;
    command: ConsoleCommandRow;
}) {
    const [chunks, setChunks] = useState<string[]>([]);
    const [status, setStatus] = useState(command.status);
    const offsetRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        async function poll() {
            const response = await fetch(
                commandLog.url(
                    { site: siteId, command: command.uuid },
                    { query: { offset: offsetRef.current } },
                ),
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok || cancelled) {
                return;
            }

            const data = (await response.json()) as {
                offset: number;
                chunk: string;
                status: string;
            };

            if (data.chunk) {
                setChunks((previous) => [...previous, data.chunk]);
            }

            offsetRef.current = data.offset;
            setStatus(data.status);
        }

        void poll();

        const interval = window.setInterval(() => {
            if (status === 'running' || status === 'queued') {
                void poll();
            }
        }, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [command.uuid, siteId, status]);

    return (
        <Terminal
            title={command.command}
            status={commandTerminalStatus(status)}
            chunks={chunks}
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
    sslCertificate,
    siteSettings,
    runtimeOptions,
    supervisorProcesses,
    cronJobs,
    environment,
    consoleCommands,
    activeCommand,
}: Props) {
    if (tab === 'overview') {
        return (
            <>
                <Head title={`${site.name} — Overview`} />
                <OverviewTab site={site} />
            </>
        );
    }

    if (tab === 'domains') {
        return (
            <>
                <Head title={`${site.name} — Domains`} />
                <DomainsTab site={site} />
            </>
        );
    }

    if (tab === 'nginx' && nginx) {
        return (
            <>
                <Head title={`${site.name} — Nginx`} />
                <NginxTab site={site} nginx={nginx} />
            </>
        );
    }

    if (tab === 'isolation') {
        return (
            <>
                <Head title={`${site.name} — Isolation`} />
                <ServingPanel site={site} />
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
                    activeDeployment={activeDeployment}
                />
            </>
        );
    }

    if (tab === 'ssl') {
        return (
            <>
                <Head title={`${site.name} — SSL`} />
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
                <SupervisorTab site={site} processes={supervisorProcesses} />
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

SiteShow.layout = {
    breadcrumbs: (props: Props) => [
        { title: 'Sites', href: sitesIndex() },
        {
            title: props.site.name,
            href: show(props.site.id, { query: { tab: 'overview' } }),
        },
    ],
};
