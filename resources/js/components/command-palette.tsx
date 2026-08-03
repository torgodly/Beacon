import { router } from '@inertiajs/react';
import {
    Copy,
    Database,
    Globe,
    Play,
    RefreshCw,
    Server,
    Terminal,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { useClipboard } from '@/hooks/use-clipboard';
import { dashboard } from '@/routes';
import { index as databasesIndex } from '@/routes/databases';
import { edit as serverEdit } from '@/routes/server';
import { restart as restartService } from '@/routes/services';
import { show as siteShow } from '@/routes/sites';
import { store as storeSiteCommand } from '@/routes/sites/commands';
import { store as storeDeployment } from '@/routes/sites/deployments';

export type CommandPalettePayload = {
    sites: Array<{ id: string; name: string }>;
    databases: Array<{ name: string }>;
    server: {
        public_ip: string;
        ssh_public_key: string | null;
    };
};

export function CommandPalette({ data }: { data: CommandPalettePayload }) {
    const [open, setOpen] = useState(false);
    const [, copy] = useClipboard();

    const run = useCallback((action: () => void) => {
        setOpen(false);
        action();
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() === 'k' &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault();
                setOpen((previous) => !previous);
            }
        };

        document.addEventListener('keydown', onKeyDown);

        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Search sites, actions, and settings…" />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Navigation">
                    <CommandItem
                        onSelect={() => run(() => router.visit(dashboard()))}
                    >
                        <Globe />
                        Dashboard
                    </CommandItem>
                    <CommandItem
                        onSelect={() => run(() => router.visit(serverEdit()))}
                    >
                        <Server />
                        Server settings
                    </CommandItem>
                    <CommandItem
                        onSelect={() =>
                            run(() => router.visit(databasesIndex()))
                        }
                    >
                        <Database />
                        Databases
                    </CommandItem>
                </CommandGroup>

                {data.sites.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Sites">
                            {data.sites.map((site) => (
                                <CommandItem
                                    key={site.id}
                                    value={`site ${site.name}`}
                                    onSelect={() =>
                                        run(() =>
                                            router.visit(siteShow(site.id)),
                                        )
                                    }
                                >
                                    <Globe />
                                    {site.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                {data.databases.length > 0 && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Databases">
                            {data.databases.map((database) => (
                                <CommandItem
                                    key={database.name}
                                    value={`database ${database.name}`}
                                    onSelect={() =>
                                        run(() =>
                                            router.visit(databasesIndex()),
                                        )
                                    }
                                >
                                    <Database />
                                    {database.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />
                <CommandGroup heading="Quick actions">
                    {data.sites.map((site) => (
                        <CommandItem
                            key={`deploy-${site.id}`}
                            value={`deploy ${site.name}`}
                            onSelect={() =>
                                run(() =>
                                    router.post(
                                        storeDeployment.url(site.id),
                                        {},
                                        { preserveScroll: true },
                                    ),
                                )
                            }
                        >
                            <Play />
                            Deploy {site.name}
                        </CommandItem>
                    ))}
                    <CommandItem
                        value="restart nginx"
                        onSelect={() =>
                            run(() =>
                                router.post(restartService.url('nginx'), {}),
                            )
                        }
                    >
                        <RefreshCw />
                        Restart Nginx
                    </CommandItem>
                    {data.sites[0] && (
                        <>
                            <CommandItem
                                value="clear artisan cache"
                                onSelect={() =>
                                    run(() =>
                                        router.post(
                                            storeSiteCommand.url(
                                                data.sites[0].id,
                                            ),
                                            {
                                                command:
                                                    'php artisan cache:clear',
                                            },
                                            { preserveScroll: true },
                                        ),
                                    )
                                }
                            >
                                <Trash2 />
                                Clear Artisan cache
                                <CommandShortcut>
                                    {data.sites[0].name}
                                </CommandShortcut>
                            </CommandItem>
                            <CommandItem
                                value="run command console"
                                onSelect={() =>
                                    run(() =>
                                        router.visit(
                                            siteShow(data.sites[0].id, {
                                                query: { tab: 'console' },
                                            }),
                                        ),
                                    )
                                }
                            >
                                <Terminal />
                                Open web console
                            </CommandItem>
                        </>
                    )}
                </CommandGroup>

                <CommandSeparator />
                <CommandGroup heading="Copy">
                    <CommandItem
                        value="copy server ip"
                        onSelect={() =>
                            run(async () => {
                                const copied = await copy(
                                    data.server.public_ip,
                                );

                                if (copied) {
                                    toast.success('Public IP copied');
                                }
                            })
                        }
                    >
                        <Copy />
                        Copy server public IP
                        <CommandShortcut>
                            {data.server.public_ip}
                        </CommandShortcut>
                    </CommandItem>
                    {data.server.ssh_public_key && (
                        <CommandItem
                            value="copy ssh public key"
                            onSelect={() =>
                                run(async () => {
                                    const copied = await copy(
                                        data.server.ssh_public_key ?? '',
                                    );

                                    if (copied) {
                                        toast.success('SSH public key copied');
                                    }
                                })
                            }
                        >
                            <Copy />
                            Copy SSH public key
                        </CommandItem>
                    )}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
