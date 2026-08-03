import { Form, Head, router } from '@inertiajs/react';
import { Boxes } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { HealthBanner } from '@/components/health-banner';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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

    return (
        <>
            <Head title="Runtimes" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <HealthBanner />
                <Heading
                    title="Runtimes"
                    description="Node.js and Bun versions discovered on this server."
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Build memory budget
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Node builds use up to {nodeHeapMb} MB heap (
                        <code>NODE_OPTIONS=--max-old-space-size</code>).
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Default package manager
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form
                            {...updatePackageManager.form()}
                            className="flex max-w-xs flex-col gap-3"
                        >
                            {({ processing }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="package_manager">
                                            New sites use
                                        </Label>
                                        <Select
                                            value={packageManager}
                                            onValueChange={setPackageManager}
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
                                        <input
                                            type="hidden"
                                            name="package_manager"
                                            value={packageManager}
                                        />
                                    </div>
                                    <Button type="submit" disabled={processing}>
                                        Save default
                                    </Button>
                                </>
                            )}
                        </Form>
                    </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                    <RuntimeSection
                        title="Node.js"
                        icon={Boxes}
                        supported={supportedNode}
                        runtimes={nodeRuntimes}
                        defaultVersion={defaultNodeVersion}
                    />
                    <RuntimeSection
                        title="Bun"
                        icon={Boxes}
                        supported={['default']}
                        runtimes={bunRuntimes}
                        defaultVersion={
                            defaultPackageManager === 'bun'
                                ? (bunRuntimes[0]?.version ?? '')
                                : ''
                        }
                    />
                </div>
            </div>
        </>
    );
}

function RuntimeSection({
    title,
    icon: Icon,
    supported,
    runtimes,
    defaultVersion,
}: {
    title: string;
    icon: typeof Boxes;
    supported: string[];
    runtimes: RuntimeRow[];
    defaultVersion: string;
}) {
    const installed = new Set(
        runtimes
            .filter((runtime) => runtime.status === 'installed')
            .map((runtime) => runtime.version),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-4" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {supported.map((version) => {
                    const record = runtimes.find(
                        (runtime) => runtime.version === version,
                    );

                    return (
                        <div
                            key={version}
                            className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                        >
                            <div>
                                <p className="font-medium">{version}</p>
                                {record?.path && (
                                    <p className="font-mono text-xs text-muted-foreground">
                                        {record.path}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge
                                    status={
                                        installed.has(version)
                                            ? 'success'
                                            : 'stopped'
                                    }
                                    label={record?.status ?? 'not installed'}
                                />
                                {record?.status === 'installed' &&
                                    title === 'Node.js' &&
                                    !record.is_default && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                router.patch(
                                                    setDefaultRuntime.url(
                                                        record.id,
                                                    ),
                                                )
                                            }
                                        >
                                            Set default
                                        </Button>
                                    )}
                                {(record?.is_default ||
                                    defaultVersion === version) &&
                                    installed.has(version) && (
                                        <span className="text-xs text-muted-foreground">
                                            Default
                                        </span>
                                    )}
                            </div>
                        </div>
                    );
                })}
                {runtimes.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        No {title} runtimes detected under /usr/local.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

RuntimesIndex.layout = {
    breadcrumbs: [{ title: 'Runtimes', href: runtimesIndex() }],
};
