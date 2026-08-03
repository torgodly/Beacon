import { Head, router, usePage } from '@inertiajs/react';
import { Github, RotateCw, Unplug } from 'lucide-react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { destroy, edit } from '@/routes/github';
import { redeliver } from '@/routes/github/deliveries';

type Manifest = Record<string, unknown>;

type Installation = {
    app_slug: string;
    account_login: string | null;
    installation_id: number | null;
    webhook_reachable: boolean;
    last_delivery_status: number | null;
    connected_at: string | null;
    install_url: string | null;
};

type Delivery = {
    id: number;
    delivery_id: string;
    event: string;
    repository: string | null;
    status_code: number | null;
    created_at: string | null;
    redelivered_at: string | null;
};

type Props = {
    manifest: Manifest;
    installation: Installation | null;
    deliveries: Delivery[];
};

export default function GitHubSettings({
    manifest,
    installation,
    deliveries,
}: Props) {
    const { errors } = usePage().props as {
        errors: Record<string, string>;
    };

    const connected =
        installation !== null && installation.installation_id !== null;
    const pendingInstall =
        installation !== null && installation.installation_id === null;

    return (
        <>
            <Head title="GitHub settings" />

            <h1 className="sr-only">GitHub settings</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="GitHub App"
                    description="Connect a GitHub App to deploy from private repositories and receive push webhooks."
                />

                <InputError message={errors.github} />

                {!installation && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Register Beacon on GitHub
                            </CardTitle>
                            <CardDescription>
                                Creates a GitHub App on your account and
                                redirects back here to finish setup.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form
                                action="https://github.com/settings/apps/new"
                                method="post"
                            >
                                <input
                                    type="hidden"
                                    name="manifest"
                                    value={JSON.stringify(manifest)}
                                />
                                <Button type="submit">
                                    <Github className="size-4" />
                                    Connect GitHub
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {pendingInstall && installation.install_url && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Install the app
                            </CardTitle>
                            <CardDescription>
                                The GitHub App was created. Install it on your
                                account or organization to finish connecting.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild>
                                <a href={installation.install_url}>
                                    <Github className="size-4" />
                                    Install on GitHub
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {connected && installation && (
                    <Card>
                        <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <CardTitle className="text-base">
                                        Connected
                                    </CardTitle>
                                    <CardDescription>
                                        Installed as{' '}
                                        <span className="font-medium text-foreground">
                                            {installation.account_login}
                                        </span>
                                    </CardDescription>
                                </div>
                                <StatusBadge
                                    status={
                                        installation.webhook_reachable
                                            ? 'success'
                                            : 'warning'
                                    }
                                    label={
                                        installation.webhook_reachable
                                            ? 'Webhooks reachable'
                                            : 'Webhooks unreachable'
                                    }
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <dl className="grid gap-2 text-sm">
                                <div className="flex justify-between gap-4">
                                    <dt className="text-muted-foreground">
                                        App slug
                                    </dt>
                                    <dd className="font-mono">
                                        {installation.app_slug}
                                    </dd>
                                </div>
                                {installation.last_delivery_status !== null && (
                                    <div className="flex justify-between gap-4">
                                        <dt className="text-muted-foreground">
                                            Last delivery
                                        </dt>
                                        <dd>
                                            HTTP{' '}
                                            {installation.last_delivery_status}
                                        </dd>
                                    </div>
                                )}
                            </dl>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    router.delete(destroy.url(), {
                                        preserveScroll: true,
                                    })
                                }
                            >
                                <Unplug className="size-4" />
                                Disconnect
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {deliveries.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Recent deliveries
                            </CardTitle>
                            <CardDescription>
                                Webhook events received by this panel.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="divide-y rounded-lg border">
                                {deliveries.map((delivery) => (
                                    <li
                                        key={delivery.id}
                                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                    >
                                        <div>
                                            <span className="font-medium">
                                                {delivery.event}
                                            </span>
                                            {delivery.repository && (
                                                <span className="ml-2 text-muted-foreground">
                                                    {delivery.repository}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            {delivery.status_code !== null && (
                                                <span>
                                                    {delivery.status_code}
                                                </span>
                                            )}
                                            {delivery.redelivered_at && (
                                                <span className="text-xs">
                                                    Redelivered{' '}
                                                    {new Date(
                                                        delivery.redelivered_at,
                                                    ).toLocaleString()}
                                                </span>
                                            )}
                                            {delivery.created_at && (
                                                <time
                                                    dateTime={
                                                        delivery.created_at
                                                    }
                                                >
                                                    {new Date(
                                                        delivery.created_at,
                                                    ).toLocaleString()}
                                                </time>
                                            )}
                                            {connected && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        router.post(
                                                            redeliver.url(
                                                                delivery.id,
                                                            ),
                                                            {},
                                                            {
                                                                preserveScroll: true,
                                                            },
                                                        )
                                                    }
                                                >
                                                    <RotateCw className="size-3.5" />
                                                    Redeliver
                                                </Button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}

GitHubSettings.layout = {
    breadcrumbs: [
        {
            title: 'GitHub settings',
            href: edit(),
        },
    ],
};
