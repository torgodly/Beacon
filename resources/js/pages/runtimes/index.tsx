import { Form, Head, router } from '@inertiajs/react';
import { Boxes, MemoryStick, Star } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, PageHeader } from '@/components/console/page-header';
import { Panel, SpecList, StatCluster } from '@/components/console/panel';
import { HealthBanner } from '@/components/health-banner';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    index as runtimesIndex,
    defaultMethod as setDefaultRuntime,
    packageManager as updatePackageManager,
} from '@/routes/runtimes';

type RuntimeRow = {
    id: number;
    runtime: string;
    version: string;
    path: string;
    status: string;
    is_default: boolean;
};

function RuntimeTable({
    rows,
    canSetDefault,
}: {
    rows: RuntimeRow[];
    canSetDefault: boolean;
}) {
    return (
        <DataTable>
            <TableHead>
                <TableRow>
                    <TableHeaderCell>Version</TableHeaderCell>
                    <TableHeaderCell>Path</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell />
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map((runtime) => (
                    <TableRow key={runtime.id} interactive>
                        <TableCell>
                            <span className="font-mono text-[14px] font-medium text-fg">
                                {runtime.version}
                            </span>
                            {runtime.is_default && (
                                <span className="text-overline ms-2 inline-flex items-center gap-1 font-mono text-fg-brand">
                                    <Star aria-hidden="true" className="size-3" />
                                    default
                                </span>
                            )}
                        </TableCell>
                        <TableCell>
                            <span className="font-mono text-[13px] text-fg-muted">
                                {runtime.path}
                            </span>
                        </TableCell>
                        <TableCell>
                            <StatusPill
                                status={toStatus(runtime.status)}
                                label={runtime.status}
                                size="sm"
                            />
                        </TableCell>
                        <TableCell className="text-right">
                            {canSetDefault && !runtime.is_default && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() =>
                                        router.patch(
                                            setDefaultRuntime.url(runtime.id),
                                        )
                                    }
                                >
                                    Make default
                                </Button>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </DataTable>
    );
}

export default function RuntimesIndex({
    runtimes,
    supportedNode,
    defaultNodeVersion,
    defaultPackageManager,
    nodeHeapMb,
}: {
    runtimes: RuntimeRow[];
    supportedNode: string[];
    defaultNodeVersion: string;
    defaultPackageManager: string;
    nodeHeapMb: number;
}) {
    const [packageManager, setPackageManager] = useState(defaultPackageManager);

    const nodeRuntimes = runtimes.filter(
        (runtime) => runtime.runtime === 'node',
    );
    const bunRuntimes = runtimes.filter((runtime) => runtime.runtime === 'bun');

    const missing = supportedNode.filter(
        (version) =>
            !nodeRuntimes.some((runtime) => runtime.version === version),
    );

    return (
        <>
            <Head title="Runtimes" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="server // runtimes"
                    title="Runtimes"
                    description="Node.js and Bun installations discovered on this server, and the defaults new sites inherit."
                />

                <HealthBanner />

                <StatCluster
                    className="max-w-2xl"
                    stats={[
                        { label: 'Node', value: nodeRuntimes.length },
                        { label: 'Bun', value: bunRuntimes.length },
                        {
                            label: 'Default node',
                            value: defaultNodeVersion || '—',
                            tone: 'brand',
                        },
                        {
                            label: 'Build heap',
                            value: `${nodeHeapMb}`,
                            hint: 'MB max-old-space',
                        },
                    ]}
                />

                <Panel
                    eyebrow="runtimes // node"
                    title="Node.js"
                    icon={Boxes}
                    description="Runs SSR servers and every JavaScript build step."
                    flush={nodeRuntimes.length > 0}
                >
                    {nodeRuntimes.length === 0 ? (
                        <EmptyState
                            icon={Boxes}
                            title="No Node runtime detected"
                            description="Beacon discovers runtimes under /usr/local/node. Install one on the host and it will appear here."
                            className="border-0"
                        />
                    ) : (
                        <RuntimeTable rows={nodeRuntimes} canSetDefault />
                    )}
                </Panel>

                {missing.length > 0 && (
                    <Panel
                        eyebrow="runtimes // not installed"
                        title="Supported but absent"
                        description="These versions are supported by Beacon but are not present on this host yet."
                    >
                        <div className="flex flex-wrap gap-1.5">
                            {missing.map((version) => (
                                <span
                                    key={version}
                                    className="inline-flex items-center rounded-sm border border-dashed border-[var(--bc-border-default)] px-2 py-1 font-mono text-[12px] leading-[18px] text-fg-disabled"
                                >
                                    node {version}
                                </span>
                            ))}
                        </div>
                    </Panel>
                )}

                <Panel
                    eyebrow="runtimes // bun"
                    title="Bun"
                    icon={Boxes}
                    description="An alternative package manager and build runtime."
                    flush={bunRuntimes.length > 0}
                >
                    {bunRuntimes.length === 0 ? (
                        <EmptyState
                            icon={Boxes}
                            title="Bun is not installed"
                            description="Beacon looks for Bun at /usr/local/bun/default/bin/bun."
                            className="border-0"
                        />
                    ) : (
                        <RuntimeTable rows={bunRuntimes} canSetDefault={false} />
                    )}
                </Panel>

                <div className="grid gap-4 lg:grid-cols-2">
                    <Panel
                        eyebrow="runtimes // defaults"
                        title="Default package manager"
                        description="Applied to newly created sites. Existing sites keep their own setting."
                    >
                        <Form
                            action={updatePackageManager()}
                            options={{ preserveScroll: true }}
                        >
                            {({ processing }) => (
                                <div className="flex flex-wrap items-end gap-3">
                                    <Select
                                        value={packageManager}
                                        onValueChange={setPackageManager}
                                        name="package_manager"
                                    >
                                        <SelectTrigger
                                            id="package_manager"
                                            className="w-48"
                                            aria-label="Default package manager"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="npm">npm</SelectItem>
                                            <SelectItem value="bun">bun</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={processing}
                                    >
                                        {processing ? 'Saving…' : 'Save'}
                                    </Button>
                                </div>
                            )}
                        </Form>
                    </Panel>

                    <Panel
                        eyebrow="runtimes // memory"
                        title="Build memory budget"
                        icon={MemoryStick}
                        description="Caps V8's heap so a Next.js build cannot take the database down with it."
                    >
                        <SpecList
                            columns={2}
                            items={[
                                {
                                    label: 'NODE_OPTIONS',
                                    value: `--max-old-space-size=${nodeHeapMb}`,
                                },
                                {
                                    label: 'Applied to',
                                    value: 'every deploy',
                                    mono: false,
                                },
                            ]}
                        />
                    </Panel>
                </div>
            </div>
        </>
    );
}

RuntimesIndex.layout = {
    breadcrumbs: [{ title: 'Runtimes', href: runtimesIndex() }],
};
