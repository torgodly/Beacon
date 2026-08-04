import { Form, Head, router } from '@inertiajs/react';
import { Boxes, MemoryStick, Star } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/console/page-header';
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
import { HealthBanner } from '@/components/health-banner';
import { Button } from '@/components/ui/button';
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

function RuntimeRows({
    rows,
    canSetDefault,
}: {
    rows: RuntimeRow[];
    canSetDefault: boolean;
}) {
    if (rows.length === 0) {
        return (
            <ForgeListRow className="text-[#64748b]">
                No runtimes detected on this server.
            </ForgeListRow>
        );
    }

    return rows.map((runtime) => (
        <ForgeListRow key={runtime.id}>
            <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                    {runtime.version}
                    {runtime.is_default && (
                        <span className="ms-2 inline-flex items-center gap-1 text-xs font-medium text-[#18B69B]">
                            <Star className="size-3" />
                            default
                        </span>
                    )}
                </p>
                <p className="truncate font-mono text-xs text-[#64748b]">
                    {runtime.path}
                </p>
            </div>
            <ForgeStatusBadge label={runtime.status} />
            {canSetDefault && !runtime.is_default && (
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                        router.patch(setDefaultRuntime.url(runtime.id))
                    }
                >
                    Make default
                </Button>
            )}
        </ForgeListRow>
    ));
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

            <div className="mb-6">
                <HealthBanner />
            </div>

            <ForgePageLayout
                main={
                    <>
                        <ForgeDividedCard title="Node.js">
                            {nodeRuntimes.length === 0 ? (
                                <EmptyState
                                    icon={Boxes}
                                    title="No Node runtime detected"
                                    description="Beacon discovers runtimes under /usr/local/node."
                                    className="border-0 bg-transparent py-8"
                                />
                            ) : (
                                <RuntimeRows rows={nodeRuntimes} canSetDefault />
                            )}
                        </ForgeDividedCard>

                        {missing.length > 0 && (
                            <ForgeDividedCard title="Supported but absent">
                                {missing.map((version) => (
                                    <ForgeListRow key={version}>
                                        <span className="font-mono text-sm text-[#64748b]">
                                            node {version}
                                        </span>
                                    </ForgeListRow>
                                ))}
                            </ForgeDividedCard>
                        )}

                        <ForgeDividedCard title="Bun">
                            {bunRuntimes.length === 0 ? (
                                <EmptyState
                                    icon={Boxes}
                                    title="Bun is not installed"
                                    description="Beacon looks for Bun at /usr/local/bun/default/bin/bun."
                                    className="border-0 bg-transparent py-8"
                                />
                            ) : (
                                <RuntimeRows
                                    rows={bunRuntimes}
                                    canSetDefault={false}
                                />
                            )}
                        </ForgeDividedCard>

                        <ForgeDividedCard title="Default package manager">
                            <ForgeListRow className="flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                                <p className="flex-1 text-sm text-[#64748b]">
                                    Applied to newly created sites. Existing sites
                                    keep their own setting.
                                </p>
                                <Form
                                    action={updatePackageManager()}
                                    options={{ preserveScroll: true }}
                                    className="flex flex-wrap items-end gap-3"
                                >
                                    {({ processing }) => (
                                        <>
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
                                                    <SelectItem value="npm">
                                                        npm
                                                    </SelectItem>
                                                    <SelectItem value="bun">
                                                        bun
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                type="submit"
                                                variant="primary"
                                                size="sm"
                                                disabled={processing}
                                            >
                                                {processing ? 'Saving…' : 'Save'}
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </ForgeListRow>
                        </ForgeDividedCard>
                    </>
                }
                sidebar={
                    <>
                        <ForgeDetailsSection title="Runtime">
                            <ForgeDetailRow
                                label="Node"
                                value={String(nodeRuntimes.length)}
                            />
                            <ForgeDetailRow
                                label="Bun"
                                value={String(bunRuntimes.length)}
                            />
                            <ForgeDetailRow
                                label="Default node"
                                value={defaultNodeVersion || '—'}
                                mono
                            />
                        </ForgeDetailsSection>

                        <ForgeDetailsSection title="Build memory">
                            <ForgeDetailRow
                                label="NODE_OPTIONS"
                                value={`--max-old-space-size=${nodeHeapMb}`}
                                mono
                            />
                            <ForgeDetailRow
                                label="Applied to"
                                value="Every deploy"
                            />
                        </ForgeDetailsSection>
                    </>
                }
            />
        </>
    );
}

RuntimesIndex.layout = {
    breadcrumbs: [{ title: 'Runtimes', href: runtimesIndex() }],
};
