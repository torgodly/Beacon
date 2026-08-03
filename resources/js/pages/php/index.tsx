import { Form, Head, router } from '@inertiajs/react';
import { Code2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { HealthBanner } from '@/components/health-banner';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    destroy as destroyPhp,
    index as phpIndex,
    install as installPhp,
    defaultMethod as setDefaultPhp,
} from '@/routes/php';
import {
    disable as disableExtension,
    enable as enableExtension,
} from '@/routes/php/extensions';
import { update as updatePhpIni } from '@/routes/php/ini';

type PhpExtensionRow = {
    id: number;
    name: string;
    label: string;
    is_installed: boolean;
    is_enabled: boolean;
    is_core: boolean;
    installable: boolean;
};

type PhpVersionRow = {
    id: number;
    version: string;
    status: string;
    is_default: boolean;
    installed_at: string | null;
    last_error: string | null;
    extensions: PhpExtensionRow[];
    ini: Record<string, string>;
};

export default function PhpIndex({
    versions,
    supported,
    iniKeys,
    defaultPhpVersion,
}: {
    versions: PhpVersionRow[];
    supported: string[];
    iniKeys: string[];
    iniDefaults: Record<string, string>;
    defaultPhpVersion: string;
}) {
    const [expanded, setExpanded] = useState<string | null>(
        versions.find((v) => v.status === 'installed')?.version ?? null,
    );

    const versionMap = new Map(versions.map((v) => [v.version, v]));

    return (
        <>
            <Head title="PHP" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <HealthBanner />
                <Heading
                    title="PHP"
                    description="Install versions, manage extensions, and tune php.ini defaults."
                />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {supported.map((version) => {
                        const record = versionMap.get(version);
                        const installed = record?.status === 'installed';
                        const pending =
                            record?.status === 'installing' ||
                            record?.status === 'removing';

                        return (
                            <Card key={version} className="py-4">
                                <CardContent className="space-y-3 px-5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Code2 className="size-4 text-muted-foreground" />
                                            <div>
                                                <p className="font-medium">
                                                    PHP {version}
                                                </p>
                                                {(record?.is_default ||
                                                    defaultPhpVersion ===
                                                        version) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Server default
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <StatusBadge
                                            status={
                                                installed
                                                    ? 'success'
                                                    : pending
                                                      ? 'running'
                                                      : 'stopped'
                                            }
                                            label={
                                                record?.status ??
                                                'not installed'
                                            }
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {!installed && !pending && (
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    router.post(
                                                        installPhp.url(version),
                                                    )
                                                }
                                            >
                                                Install
                                            </Button>
                                        )}
                                        {installed && record && (
                                            <>
                                                {!record.is_default && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            router.patch(
                                                                setDefaultPhp.url(
                                                                    record.id,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        Set default
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive"
                                                    onClick={() =>
                                                        router.delete(
                                                            destroyPhp.url(
                                                                record.id,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setExpanded(
                                                            expanded === version
                                                                ? null
                                                                : version,
                                                        )
                                                    }
                                                >
                                                    Manage
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {record?.last_error && (
                                        <p className="text-xs text-destructive">
                                            {record.last_error}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {expanded &&
                    versionMap.get(expanded)?.status === 'installed' && (
                        <PhpVersionPanel
                            version={versionMap.get(expanded)!}
                            iniKeys={iniKeys}
                        />
                    )}
            </div>
        </>
    );
}

function PhpVersionPanel({
    version,
    iniKeys,
}: {
    version: PhpVersionRow;
    iniKeys: string[];
}) {
    const [iniValues, setIniValues] = useState<Record<string, string>>(
        version.ini,
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>PHP {version.version} configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <p className="mb-2 text-sm font-medium">Extensions</p>
                    <p className="mb-3 text-xs text-muted-foreground">
                        Per-site pool values override these version defaults.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {version.extensions.map((extension) => (
                            <div
                                key={extension.id}
                                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                            >
                                <span>{extension.label}</span>
                                <div className="flex items-center gap-2">
                                    <StatusBadge
                                        status={
                                            extension.is_enabled
                                                ? 'success'
                                                : extension.is_installed
                                                  ? 'stopped'
                                                  : 'failed'
                                        }
                                        label={
                                            extension.is_enabled
                                                ? 'enabled'
                                                : extension.is_installed
                                                  ? 'disabled'
                                                  : 'missing'
                                        }
                                    />
                                    {!extension.is_core && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                                !extension.is_installed &&
                                                !extension.installable
                                            }
                                            onClick={() =>
                                                router.post(
                                                    extension.is_enabled
                                                        ? disableExtension.url({
                                                              phpVersion:
                                                                  version.id,
                                                              extension:
                                                                  extension.id,
                                                          })
                                                        : enableExtension.url({
                                                              phpVersion:
                                                                  version.id,
                                                              extension:
                                                                  extension.id,
                                                          }),
                                                )
                                            }
                                        >
                                            {extension.is_enabled
                                                ? 'Disable'
                                                : 'Enable'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-sm font-medium">
                        php.ini quick config (FPM)
                    </p>
                    <Form
                        {...updatePhpIni.form(version.id)}
                        className="grid gap-3 sm:grid-cols-2"
                        onSuccess={() => {}}
                    >
                        {({ processing }) => (
                            <>
                                <input type="hidden" name="sapi" value="fpm" />
                                {iniKeys.map((key) => (
                                    <div key={key} className="grid gap-1.5">
                                        <Label htmlFor={`ini-${key}`}>
                                            {key}
                                        </Label>
                                        <Input
                                            id={`ini-${key}`}
                                            name={`settings[${key}]`}
                                            value={iniValues[key] ?? ''}
                                            onChange={(event) =>
                                                setIniValues((current) => ({
                                                    ...current,
                                                    [key]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))}
                                <div className="sm:col-span-2">
                                    <Button type="submit" disabled={processing}>
                                        <RefreshCw className="size-4" />
                                        Save php.ini
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            </CardContent>
        </Card>
    );
}

PhpIndex.layout = {
    breadcrumbs: [{ title: 'PHP', href: phpIndex() }],
};
