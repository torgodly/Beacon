import { Form, Head, Link } from '@inertiajs/react';
import { Globe, Plus } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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

type SiteTypeOption = {
    value: string;
    label: string;
};

function siteStatus(status: string): Status {
    return status === 'active' ? 'success' : 'pending';
}

export default function SitesIndex({
    sites,
    siteTypes,
    phpVersions,
}: {
    sites: SiteRow[];
    siteTypes: SiteTypeOption[];
    phpVersions: string[];
}) {
    const [createOpen, setCreateOpen] = useState(false);
    const [siteType, setSiteType] = useState('laravel');
    const [phpVersion, setPhpVersion] = useState(() => phpVersions[0] ?? '8.4');
    const showPhpVersion = siteType === 'laravel' || siteType === 'static';
    const showNodeVersion = siteType === 'nextjs' || siteType === 'nuxt';

    return (
        <>
            <Head title="Sites" />
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-end">
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="size-4" />
                                New site
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create site</DialogTitle>
                                <DialogDescription>
                                    Provision a new site directory, PHP pool,
                                    and Nginx configuration.
                                </DialogDescription>
                            </DialogHeader>

                            <Form
                                {...store.form()}
                                resetOnSuccess
                                onSuccess={() => setCreateOpen(false)}
                                className="grid gap-4"
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">
                                                Hostname
                                            </Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                placeholder="app.example.com"
                                                autoComplete="off"
                                                required
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="grid gap-2">
                                            <Label htmlFor="type">
                                                Site type
                                            </Label>
                                            <Select
                                                name="type"
                                                value={siteType}
                                                onValueChange={setSiteType}
                                            >
                                                <SelectTrigger id="type">
                                                    <SelectValue placeholder="Choose a type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {siteTypes.map((type) => (
                                                        <SelectItem
                                                            key={type.value}
                                                            value={type.value}
                                                        >
                                                            {type.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <input
                                                type="hidden"
                                                name="type"
                                                value={siteType}
                                            />
                                            <InputError message={errors.type} />
                                        </div>

                                        {showPhpVersion && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="php_version">
                                                    PHP version
                                                </Label>
                                                <Select
                                                    value={phpVersion}
                                                    onValueChange={
                                                        setPhpVersion
                                                    }
                                                >
                                                    <SelectTrigger id="php_version">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {phpVersions.map(
                                                            (version) => (
                                                                <SelectItem
                                                                    key={
                                                                        version
                                                                    }
                                                                    value={
                                                                        version
                                                                    }
                                                                >
                                                                    PHP{' '}
                                                                    {version}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <input
                                                    type="hidden"
                                                    name="php_version"
                                                    value={phpVersion}
                                                />
                                                <InputError
                                                    message={errors.php_version}
                                                />
                                            </div>
                                        )}

                                        {showNodeVersion && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="node_version">
                                                    Node version
                                                </Label>
                                                <Input
                                                    id="node_version"
                                                    name="node_version"
                                                    defaultValue="22"
                                                    required
                                                />
                                                <InputError
                                                    message={
                                                        errors.node_version
                                                    }
                                                />
                                            </div>
                                        )}

                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            className="w-full"
                                        >
                                            Create site
                                        </Button>
                                    </>
                                )}
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>

                {sites.length === 0 ? (
                    <Card className="py-12">
                        <CardContent className="flex flex-col items-center gap-3 text-center">
                            <Globe className="size-10 text-muted-foreground" />
                            <div>
                                <p className="font-medium">No sites yet</p>
                                <p className="text-sm text-muted-foreground">
                                    Create your first site to start deploying
                                    applications.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {sites.map((site) => (
                            <Card key={site.id} className="py-4">
                                <CardContent className="flex flex-col gap-3 px-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <Link
                                                href={show(site.id)}
                                                className="font-medium hover:underline"
                                            >
                                                {site.name}
                                            </Link>
                                            <p className="text-xs text-muted-foreground">
                                                {site.primary_domain}
                                            </p>
                                        </div>
                                        <StatusBadge
                                            status={siteStatus(site.status)}
                                            label={site.status}
                                        />
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span className="rounded-md bg-muted px-2 py-1 capitalize">
                                            {site.type}
                                        </span>
                                        <span className="rounded-md bg-muted px-2 py-1">
                                            SSL: {site.ssl_status}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

SitesIndex.layout = {
    breadcrumbs: [{ title: 'Sites', href: sitesIndex() }],
};
