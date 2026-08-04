import { Form, Head, router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronRight,
    Download,
    Puzzle,
    Search,
    SlidersHorizontal,
    Star,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import { HealthBanner } from '@/components/health-banner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
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

/**
 * Three-state extension chip: not installed / installed+disabled / enabled.
 *
 * State is never conveyed by colour alone — each chip carries a check glyph,
 * a text label and a title, so it reads correctly in greyscale.
 */
function ExtensionChip({
    extension,
    pending,
    disabled,
    onToggle,
}: {
    extension: PhpExtensionRow;
    pending: boolean;
    disabled: boolean;
    onToggle: (extension: PhpExtensionRow) => void;
}) {
    const state: 'enabled' | 'available' | 'missing' = extension.is_enabled
        ? 'enabled'
        : extension.is_installed
          ? 'available'
          : 'missing';

    const canToggle = !extension.is_core && !disabled && !pending;

    return (
        <button
            type="button"
            disabled={!canToggle}
            aria-busy={pending}
            title={
                pending
                    ? `Working on ${extension.name}…`
                    : extension.is_core
                      ? `${extension.name} is required by Beacon`
                      : state === 'missing'
                        ? `Install ${extension.name}`
                        : state === 'enabled'
                          ? `Disable ${extension.name}`
                          : `Enable ${extension.name}`
            }
            onClick={() => onToggle(extension)}
            className={cn(
                'group inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[18px] transition-colors duration-[--bc-duration-fast]',
                pending && 'border-primary/30 bg-primary/5 text-primary',
                !pending &&
                    state === 'enabled' &&
                    'border-[var(--bc-border-success)]/40 bg-success-subtle text-fg-success',
                !pending &&
                    state === 'available' &&
                    'border-[var(--bc-border-default)] bg-[var(--bc-bg-subtle)] text-fg-muted hover:border-border-hover',
                !pending &&
                    state === 'missing' &&
                    'border-dashed border-[var(--bc-border-default)] text-fg-disabled hover:border-border-hover hover:text-fg-muted',
                !canToggle && !pending && 'cursor-not-allowed opacity-70',
                pending && 'cursor-wait',
            )}
        >
            {pending ? (
                <Spinner tone="brand" className="size-3" />
            ) : state === 'enabled' ? (
                <Check aria-hidden="true" className="size-3" />
            ) : state === 'missing' ? (
                <Download aria-hidden="true" className="size-3" />
            ) : (
                <span
                    aria-hidden="true"
                    className="size-3 rounded-[2px] border border-current opacity-50"
                />
            )}
            {extension.name}
            {extension.is_core && (
                <span className="text-fg-disabled">·locked</span>
            )}
        </button>
    );
}

function PhpVersionExtensions({
    version,
    filter,
    disabled,
    errorMessage,
}: {
    version: PhpVersionRow;
    filter: string;
    disabled: boolean;
    errorMessage?: string;
}) {
    const [extensions, setExtensions] = useState(version.extensions);
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

    useEffect(() => {
        setExtensions(version.extensions);
    }, [version.extensions]);

    const toggleExtension = useCallback(
        (extension: PhpExtensionRow) => {
            const enabling = !extension.is_enabled;
            const url = enabling
                ? enableExtension.url([version.id, extension.id])
                : disableExtension.url([version.id, extension.id]);

            setPendingIds((current) => new Set(current).add(extension.id));
            setExtensions((current) =>
                current.map((row) =>
                    row.id === extension.id
                        ? {
                              ...row,
                              is_installed: true,
                              is_enabled: enabling,
                          }
                        : row,
                ),
            );

            router.post(
                url,
                {},
                {
                    preserveScroll: true,
                    onError: () => {
                        setExtensions(version.extensions);
                    },
                    onFinish: () => {
                        setPendingIds((current) => {
                            const next = new Set(current);
                            next.delete(extension.id);

                            return next;
                        });
                    },
                },
            );
        },
        [version.extensions, version.id],
    );

    const visibleExtensions = extensions.filter((extension) =>
        extension.name.includes(filter.trim().toLowerCase()),
    );

    return (
        <section className="space-y-3">
            {errorMessage ? (
                <p
                    role="alert"
                    className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
                >
                    {errorMessage}
                </p>
            ) : null}

            <div className="flex flex-wrap gap-1.5">
                {visibleExtensions.map((extension) => (
                    <ExtensionChip
                        key={extension.id}
                        extension={extension}
                        pending={pendingIds.has(extension.id)}
                        disabled={disabled}
                        onToggle={toggleExtension}
                    />
                ))}
            </div>

            <p className="text-caption text-fg-subtle">
                Click an extension to install, enable, or disable it. A spinner
                shows while apt/phpenmod runs; the chip updates when the server
                confirms the change. Core extensions marked locked cannot be
                turned off.
            </p>
        </section>
    );
}

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
    const { errors } = usePage<{ errors?: { extension?: string } }>().props;
    const extensionError = errors?.extension;

    const [expanded, setExpanded] = useState<string | null>(
        versions.find((version) => version.status === 'installed')?.version ??
            null,
    );
    const [filter, setFilter] = useState('');

    const versionMap = useMemo(
        () => new Map(versions.map((version) => [version.version, version])),
        [versions],
    );

    const installed = versions.filter(
        (version) => version.status === 'installed',
    );
    const enabledCount = installed.reduce(
        (total, version) =>
            total +
            version.extensions.filter((extension) => extension.is_enabled).length,
        0,
    );

    return (
        <>
            <Head title="PHP" />

            <div className="mb-6">
                <HealthBanner />
            </div>

            <ForgePageLayout
                main={
                    <ForgeDividedCard title="PHP Versions">
                        {supported.map((version) => {
                            const record = versionMap.get(version);
                            const isInstalled = record?.status === 'installed';
                            const isBusy =
                                record?.status === 'installing' ||
                                record?.status === 'removing';
                            const isOpen = expanded === version;

                            return (
                                <div key={version}>
                                    <ForgeListRow>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpanded(isOpen ? null : version)
                                            }
                                            disabled={!isInstalled}
                                            className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                                        >
                                            <ChevronRight
                                                aria-hidden="true"
                                                strokeWidth={1.5}
                                                className={cn(
                                                    'size-4 shrink-0 text-fg-disabled transition-transform duration-[--bc-duration-base]',
                                                    isOpen && 'rotate-90',
                                                    !isInstalled && 'opacity-0',
                                                )}
                                            />

                                            <span className="min-w-0 flex-1">
                                                <span className="block font-mono text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                                                    PHP {version}
                                                </span>
                                                <span className="block text-xs text-[#64748b]">
                                                    {record?.installed_at
                                                        ? `installed ${new Date(record.installed_at).toLocaleDateString()}`
                                                        : isInstalled
                                                          ? 'installed'
                                                          : 'not installed'}
                                                </span>
                                            </span>
                                        </button>

                                        {record?.is_default && (
                                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#18B69B]">
                                                <Star
                                                    aria-hidden="true"
                                                    className="size-3"
                                                />
                                                default
                                            </span>
                                        )}

                                        <ForgeStatusBadge
                                            label={record?.status ?? 'not installed'}
                                        />

                                        <div className="flex items-center gap-2">
                                            {!record || record.status === 'failed' ? (
                                                <Button
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() =>
                                                        router.post(
                                                            installPhp.url(version),
                                                        )
                                                    }
                                                >
                                                    <Download className="size-3.5" />
                                                    Install
                                                </Button>
                                            ) : (
                                                <>
                                                    {isInstalled &&
                                                        !record.is_default && (
                                                            <Button
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    router.patch(
                                                                        setDefaultPhp.url(
                                                                            record.id,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                Make default
                                                            </Button>
                                                        )}

                                                    {isInstalled &&
                                                        !record.is_default && (
                                                            <ConfirmDialog
                                                                trigger={
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        aria-label={`Remove PHP ${version}`}
                                                                    >
                                                                        <Trash2 className="size-3.5" />
                                                                    </Button>
                                                                }
                                                                title={`Remove PHP ${version}?`}
                                                                description="Any site pinned to this version will stop serving until it is moved to another runtime."
                                                                confirmLabel="Remove"
                                                                destructive
                                                                onConfirm={() =>
                                                                    router.delete(
                                                                        destroyPhp.url(
                                                                            record.id,
                                                                        ),
                                                                    )
                                                                }
                                                            />
                                                        )}
                                                </>
                                            )}
                                        </div>
                                    </ForgeListRow>

                                    {record?.last_error && (
                                        <ForgeListRow>
                                            <p
                                                role="alert"
                                                className="w-full rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-600 dark:text-red-400"
                                            >
                                                {record.last_error}
                                            </p>
                                        </ForgeListRow>
                                    )}

                                    {isBusy && (
                                        <ForgeListRow className="text-sm text-[#64748b]">
                                            Running — open the operations dock
                                            (bottom right) to watch the apt output
                                            live.
                                        </ForgeListRow>
                                    )}

                                    {isOpen && record && isInstalled && (
                                        <ForgeListRow className="flex-col items-stretch gap-6 bg-[#f8fafc] dark:bg-[#151718]/60">
                                            <section className="space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <h3 className="text-overline inline-flex items-center gap-2 font-mono text-fg-subtle">
                                                        <Puzzle
                                                            aria-hidden="true"
                                                            className="size-3.5"
                                                        />
                                                        extensions
                                                    </h3>

                                                    <div className="relative">
                                                        <Search
                                                            aria-hidden="true"
                                                            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-disabled"
                                                        />
                                                        <Input
                                                            value={filter}
                                                            onChange={(event) =>
                                                                setFilter(
                                                                    event.target.value,
                                                                )
                                                            }
                                                            placeholder="redis, imagick…"
                                                            aria-label="Filter extensions"
                                                            mono
                                                            className="h-8 w-52 ps-8"
                                                        />
                                                    </div>
                                                </div>

                                                <PhpVersionExtensions
                                                    version={record}
                                                    filter={filter}
                                                    disabled={isBusy}
                                                    errorMessage={extensionError}
                                                />
                                            </section>

                                            <section className="space-y-3">
                                                <h3 className="text-overline inline-flex items-center gap-2 font-mono text-fg-subtle">
                                                    <SlidersHorizontal
                                                        aria-hidden="true"
                                                        className="size-3.5"
                                                    />
                                                    php.ini
                                                </h3>

                                                <Form
                                                    action={updatePhpIni(record.id)}
                                                    options={{ preserveScroll: true }}
                                                >
                                                    {({ processing, errors }) => (
                                                        <div className="space-y-4">
                                                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                                                {iniKeys.map((key) => (
                                                                    <Field
                                                                        key={key}
                                                                        htmlFor={`${record.id}-${key}`}
                                                                        label={key}
                                                                        error={
                                                                            errors[
                                                                                `settings.${key}`
                                                                            ]
                                                                        }
                                                                    >
                                                                        <Input
                                                                            id={`${record.id}-${key}`}
                                                                            name={`settings[${key}]`}
                                                                            defaultValue={
                                                                                record
                                                                                    .ini[
                                                                                    key
                                                                                ] ?? ''
                                                                            }
                                                                            mono
                                                                            className="h-9"
                                                                        />
                                                                    </Field>
                                                                ))}
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                <Button
                                                                    type="submit"
                                                                    size="sm"
                                                                    variant="primary"
                                                                    disabled={processing}
                                                                >
                                                                    {processing
                                                                        ? 'Saving…'
                                                                        : 'Save php.ini'}
                                                                </Button>
                                                                <p className="text-caption text-fg-subtle">
                                                                    Per-site pool
                                                                    values override
                                                                    these defaults.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </Form>
                                            </section>
                                        </ForgeListRow>
                                    )}
                                </div>
                            );
                        })}
                    </ForgeDividedCard>
                }
                sidebar={
                    <ForgeDetailsSection title="Runtime">
                        <ForgeDetailRow
                            label="Installed"
                            value={String(installed.length)}
                        />
                        <ForgeDetailRow
                            label="Default"
                            value={defaultPhpVersion || '—'}
                            mono
                        />
                        <ForgeDetailRow
                            label="Extensions on"
                            value={String(enabledCount)}
                        />
                    </ForgeDetailsSection>
                }
            />
        </>
    );
}

PhpIndex.layout = {
    breadcrumbs: [{ title: 'PHP', href: phpIndex() }],
};
