import { Form, Head, Link } from '@inertiajs/react';
import { ChevronRight, Globe, Plus, ShieldCheck, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/console/page-header';
import { Panel, StatCluster } from '@/components/console/panel';
import InputError from '@/components/input-error';
import { StatusPill, toStatus } from '@/components/status-pill';
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
    DialogContent,
    DialogDescription,
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
import { index as sitesIndex, show, store } from '@/routes/sites';

type SiteRow = {
    id: string;
    name: string;
    type: string;
    status: string;
    ssl_status: string;
    deployment_status: string;
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

/** Sensible document roots per type, offered as one-click presets. */
const WEB_DIRECTORY_PRESETS: Record<string, string[]> = {
    laravel: ['/public'],
    static: ['/dist', '/build', '/out', '/public', '/'],
    nextjs: [],
    nuxt: [],
};

const TYPE_LABELS: Record<string, string> = {
    laravel: 'Laravel',
    nextjs: 'Next.js',
    nuxt: 'Nuxt',
    static: 'Static',
};

export default function SitesIndex({
    sites,
    siteTypes,
    phpVersions,
    nodeVersions,
    packageManager,
}: {
    sites: SiteRow[];
    siteTypes: SiteTypeOption[];
    phpVersions: RuntimeOption[];
    nodeVersions: RuntimeOption[];
    packageManager: string;
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

    // Reset the document root whenever the type changes so the placeholder
    // always reflects the default that type will actually get.
    const typeDefaultRoot = selected?.web_directory ?? '';
    const servesFromDisk = runtime === 'php' || runtime === 'none';

    // A runtime the site needs but the server does not have is a hard block,
    // not a validation error to discover after filling the whole form.
    const missingRuntime =
        (runtime === 'php' && phpVersions.length === 0) ||
        (runtime === 'node' && nodeVersions.length === 0);

    const stats = useMemo(() => {
        const live = sites.filter((site) => site.status === 'active').length;
        const secured = sites.filter(
            (site) => site.ssl_status === 'active' || site.ssl_status === 'issued',
        ).length;
        const failed = sites.filter(
            (site) => site.deployment_status === 'failed',
        ).length;

        return [
            { label: 'Total', value: sites.length },
            { label: 'Active', value: live, tone: 'success' as const },
            { label: 'TLS', value: secured, tone: 'brand' as const },
            {
                label: 'Failed deploys',
                value: failed,
                tone: failed > 0 ? ('danger' as const) : ('default' as const),
            },
        ];
    }, [sites]);

    return (
        <>
            <Head title="Sites" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="sites"
                    title="Sites"
                    description="Every application this server serves, with its runtime, TLS and last deployment."
                    actions={
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button variant="primary">
                                    <Plus />
                                    New site
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Create a site</DialogTitle>
                                    <DialogDescription>
                                        Beacon provisions the directory, the
                                        Nginx vhost and the runtime. Nothing is
                                        deployed until you connect a repository.
                                    </DialogDescription>
                                </DialogHeader>

                                <Form
                                    action={store()}
                                    onSuccess={() => setCreateOpen(false)}
                                    className="space-y-6"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <Field
                                                htmlFor="name"
                                                label="Domain"
                                                required
                                                error={errors.name}
                                                help="Becomes the directory name, the vhost filename and the primary domain."
                                            >
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    mono
                                                    autoFocus
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                    placeholder="app.example.com"
                                                />
                                            </Field>

                                            <fieldset className="space-y-1.5">
                                                <legend className="text-[14px] leading-5 font-medium text-fg">
                                                    Application type
                                                </legend>

                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {siteTypes.map((type) => (
                                                        <label
                                                            key={type.value}
                                                            className={cn(
                                                                'flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors duration-[--bc-duration-fast]',
                                                                siteType ===
                                                                    type.value
                                                                    ? 'border-border-brand bg-brand-subtle'
                                                                    : 'border-[var(--bc-border-default)] hover:border-border-hover',
                                                            )}
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="type"
                                                                    value={type.value}
                                                                    checked={
                                                                        siteType ===
                                                                        type.value
                                                                    }
                                                                    onChange={() =>
                                                                        setSiteType(
                                                                            type.value,
                                                                        )
                                                                    }
                                                                    className="size-3.5 accent-[var(--bc-bg-brand)]"
                                                                />
                                                                <span className="text-[14px] leading-5 font-medium text-fg">
                                                                    {type.label}
                                                                </span>
                                                            </span>
                                                            <span className="text-[13px] leading-5 text-fg-muted">
                                                                {type.description}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <InputError message={errors.type} />
                                            </fieldset>

                                            {/* Only the runtime this type actually
                                              * uses is asked for — a static site
                                              * has no FPM pool, so no PHP field. */}
                                            {runtime === 'php' && (
                                                <Field
                                                    htmlFor="php_version"
                                                    label="PHP version"
                                                    required
                                                    error={errors.php_version}
                                                    help="Only versions installed on this server are listed."
                                                >
                                                    <Select
                                                        value={phpVersion}
                                                        onValueChange={setPhpVersion}
                                                        name="php_version"
                                                        disabled={
                                                            phpVersions.length === 0
                                                        }
                                                    >
                                                        <SelectTrigger id="php_version">
                                                            <SelectValue placeholder="Select a PHP version" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {phpVersions.map(
                                                                (version) => (
                                                                    <SelectItem
                                                                        key={version.value}
                                                                        value={version.value}
                                                                    >
                                                                        {version.label}
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
                                                    error={errors.node_version}
                                                    help="Runs the SSR server behind an Nginx reverse proxy."
                                                >
                                                    <Select
                                                        value={nodeVersion}
                                                        onValueChange={setNodeVersion}
                                                        name="node_version"
                                                        disabled={
                                                            nodeVersions.length === 0
                                                        }
                                                    >
                                                        <SelectTrigger id="node_version">
                                                            <SelectValue placeholder="Select a Node version" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {nodeVersions.map(
                                                                (version) => (
                                                                    <SelectItem
                                                                        key={version.value}
                                                                        value={version.value}
                                                                    >
                                                                        {version.label}
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
                                                    Static sites are served
                                                    straight from disk. Nginx will
                                                    point at{' '}
                                                    <code className="font-mono text-fg-code">
                                                        {selected?.web_directory ??
                                                            '/dist'}
                                                    </code>{' '}
                                                    — no runtime required.
                                                </p>
                                            )}

                                            {/* Advanced settings stay collapsed:
                                              * the common path is one field and
                                              * a type, and burying the defaults
                                              * behind a toggle keeps it that
                                              * way without hiding them. */}
                                            <div className="rounded-md border border-[var(--bc-border-default)]">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setAdvancedOpen(!advancedOpen)
                                                    }
                                                    aria-expanded={advancedOpen}
                                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                                                >
                                                    <ChevronRight
                                                        aria-hidden="true"
                                                        strokeWidth={1.5}
                                                        className={cn(
                                                            'size-4 text-fg-disabled transition-transform duration-[--bc-duration-base]',
                                                            advancedOpen && 'rotate-90',
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
                                                                error={errors.web_directory}
                                                                help={`Relative to ${'/home/beacon/<domain>'}. Leave blank for ${typeDefaultRoot}.`}
                                                            >
                                                                <Input
                                                                    id="web_directory"
                                                                    name="web_directory"
                                                                    mono
                                                                    autoComplete="off"
                                                                    spellCheck={false}
                                                                    placeholder={typeDefaultRoot}
                                                                    value={webDirectory}
                                                                    onChange={(event) =>
                                                                        setWebDirectory(
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                            </Field>
                                                        )}

                                                        {servesFromDisk &&
                                                            (WEB_DIRECTORY_PRESETS[siteType] ?? [])
                                                                .length > 1 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {(
                                                                        WEB_DIRECTORY_PRESETS[
                                                                            siteType
                                                                        ] ?? []
                                                                    ).map((preset) => (
                                                                        <button
                                                                            key={preset}
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
                                                                            {preset}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                        {siteType === 'static' && (
                                                            <label className="flex items-start gap-2.5">
                                                                <input
                                                                    type="checkbox"
                                                                    name="spa_fallback"
                                                                    value="1"
                                                                    checked={spaFallback}
                                                                    onChange={(event) =>
                                                                        setSpaFallback(
                                                                            event.target.checked,
                                                                        )
                                                                    }
                                                                    className="mt-1 size-3.5 accent-[var(--bc-bg-brand)]"
                                                                />
                                                                <span>
                                                                    <span className="block text-[14px] leading-5 font-medium text-fg">
                                                                        SPA fallback
                                                                    </span>
                                                                    <span className="block text-[13px] leading-5 text-fg-muted">
                                                                        Serve index.html for unknown
                                                                        paths. Required for React
                                                                        Router, Vue Router and
                                                                        similar.
                                                                    </span>
                                                                </span>
                                                            </label>
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
                                                                    Package manager
                                                                </label>
                                                                <Select
                                                                    name="package_manager"
                                                                    defaultValue={packageManager}
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
                                                    No {runtime === 'php' ? 'PHP' : 'Node'}{' '}
                                                    runtime is installed on this
                                                    server yet. Install one before
                                                    creating this site type.
                                                </p>
                                            )}

                                            <div className="flex items-center justify-end gap-3">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => setCreateOpen(false)}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="primary"
                                                    disabled={processing || missingRuntime}
                                                >
                                                    {processing
                                                        ? 'Creating…'
                                                        : 'Create site'}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </DialogContent>
                        </Dialog>
                    }
                />

                {sites.length > 0 && (
                    <StatCluster stats={stats} className="max-w-2xl" />
                )}

                {sites.length === 0 ? (
                    <EmptyState
                        icon={Globe}
                        title="No sites yet"
                        description="Create your first site and Beacon will provision the directory, the Nginx vhost and the runtime for you."
                        action={
                            <Button
                                variant="primary"
                                onClick={() => setCreateOpen(true)}
                            >
                                <Plus />
                                New site
                            </Button>
                        }
                    />
                ) : (
                    <Panel eyebrow="sites // inventory" flush>
                        <DataTable>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Domain</TableHeaderCell>
                                    <TableHeaderCell>Type</TableHeaderCell>
                                    <TableHeaderCell>Status</TableHeaderCell>
                                    <TableHeaderCell>Deployment</TableHeaderCell>
                                    <TableHeaderCell>TLS</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {sites.map((site) => (
                                    <TableRow key={site.id} interactive>
                                        <TableCell>
                                            {/* First column is the link target. */}
                                            <Link
                                                href={show(site.name)}
                                                className="font-mono text-[14px] font-medium text-fg hover:text-fg-link"
                                            >
                                                {site.primary_domain || site.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-overline font-mono text-fg-muted">
                                                {TYPE_LABELS[site.type] ?? site.type}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <StatusPill
                                                status={toStatus(site.status)}
                                                size="sm"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5">
                                                <Zap
                                                    aria-hidden="true"
                                                    strokeWidth={1.5}
                                                    className="size-3.5 text-fg-disabled"
                                                />
                                                <StatusPill
                                                    status={toStatus(
                                                        site.deployment_status,
                                                    )}
                                                    label={site.deployment_status}
                                                    size="sm"
                                                />
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5">
                                                <ShieldCheck
                                                    aria-hidden="true"
                                                    strokeWidth={1.5}
                                                    className="size-3.5 text-fg-disabled"
                                                />
                                                <StatusPill
                                                    status={toStatus(site.ssl_status)}
                                                    label={site.ssl_status}
                                                    size="sm"
                                                />
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </DataTable>
                    </Panel>
                )}
            </div>
        </>
    );
}

SitesIndex.layout = {
    breadcrumbs: [{ title: 'Sites', href: sitesIndex() }],
};
