import { Form, Head } from '@inertiajs/react';
import { Globe, Shield } from 'lucide-react';
import { ForgeFormCard } from '@/components/forge/forge-form-card';
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
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

            <ForgeFormCard
                title="Panel access"
                description="Beacon serves the control panel from this server."
            >
                <dl className="grid gap-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <dt className="text-[#64748b]">Current URL</dt>
                        <dd className="font-mono text-[#0f172a] dark:text-[#f8fafc]">
                            {panel.app_url}
                        </dd>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <dt className="text-[#64748b]">Exposure</dt>
                        <dd>
                            <ForgeStatusBadge
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
                            <dt className="text-[#64748b]">Domain</dt>
                            <dd className="font-mono text-[#0f172a] dark:text-[#f8fafc]">
                                {panel.domain}
                                {panel.port !== 443 ? `:${panel.port}` : ''}
                            </dd>
                        </div>
                    )}
                </dl>

                {panel.can_attach_domain && (
                    <Form
                        {...attach.form()}
                        className="mt-6 grid max-w-xl gap-4 rounded-lg border border-[#e2e8f0] p-4 dark:border-[#2e3032]"
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="flex items-start gap-3">
                                    <Shield
                                        aria-hidden="true"
                                        className="mt-0.5 size-4 text-[#64748b]"
                                    />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                            Attach panel domain
                                        </p>
                                        <p className="text-sm text-[#64748b]">
                                            Upgrade an IP:8443 install to a real
                                            hostname with Let&apos;s Encrypt TLS on
                                            port 443.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="domain">Panel domain</Label>
                                    <Input
                                        id="domain"
                                        name="domain"
                                        placeholder="panel.example.com"
                                        autoComplete="off"
                                        required
                                    />
                                    <InputError message={errors.domain} />
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
                                    <InputError message={errors.email} />
                                </div>

                                <Button
                                    type="submit"
                                    variant="primary"
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
            </ForgeFormCard>
        </>
    );
}

ServerSettings.layout = {
    breadcrumbs: [{ title: 'Server', href: serverEdit() }],
};
