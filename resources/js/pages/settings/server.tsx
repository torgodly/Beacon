import { Form, Head } from '@inertiajs/react';
import { Globe, Shield } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit as serverEdit } from '@/routes/server';
import { attach } from '@/routes/server/domain';

type PanelPayload = {
    domain: string | null;
    port: number;
    url_public: boolean;
    app_url: string;
    can_attach_domain: boolean;
};

export default function ServerSettings({ panel }: { panel: PanelPayload }) {
    return (
        <>
            <Head title="Server settings" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Server"
                    description="Panel exposure, TLS, and host-level configuration."
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">
                            Panel access
                        </CardTitle>
                        <CardDescription>
                            Beacon serves the control panel from this server.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <dl className="grid gap-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <dt className="text-muted-foreground">
                                    Current URL
                                </dt>
                                <dd className="font-mono">{panel.app_url}</dd>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <dt className="text-muted-foreground">
                                    Exposure
                                </dt>
                                <dd>
                                    <StatusBadge
                                        status={
                                            panel.url_public
                                                ? 'success'
                                                : 'warning'
                                        }
                                        label={
                                            panel.url_public
                                                ? 'Public domain'
                                                : 'IP / self-signed'
                                        }
                                    />
                                </dd>
                            </div>
                            {panel.domain && (
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <dt className="text-muted-foreground">
                                        Domain
                                    </dt>
                                    <dd className="font-mono">
                                        {panel.domain}
                                        {panel.port !== 443
                                            ? `:${panel.port}`
                                            : ''}
                                    </dd>
                                </div>
                            )}
                        </dl>

                        {panel.can_attach_domain && (
                            <Form
                                {...attach.form()}
                                className="grid max-w-xl gap-4 rounded-lg border p-4"
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <div className="flex items-start gap-3">
                                            <Shield className="mt-0.5 size-4 text-muted-foreground" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium">
                                                    Attach panel domain
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Upgrade an IP:8443 install
                                                    to a real hostname with
                                                    Let&apos;s Encrypt TLS on
                                                    port 443. GitHub webhooks
                                                    will be updated
                                                    automatically.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="domain">
                                                Panel domain
                                            </Label>
                                            <Input
                                                id="domain"
                                                name="domain"
                                                placeholder="panel.example.com"
                                                autoComplete="off"
                                                required
                                            />
                                            <InputError
                                                message={errors.domain}
                                            />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="email">
                                                Let&apos;s Encrypt email
                                            </Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                placeholder="admin@example.com"
                                                autoComplete="email"
                                                required
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="w-fit"
                                        >
                                            <Globe className="size-4" />
                                            Attach domain
                                        </Button>
                                    </>
                                )}
                            </Form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ServerSettings.layout = {
    breadcrumbs: [{ title: 'Server', href: serverEdit() }],
};
