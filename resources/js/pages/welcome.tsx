import { Head, Link, usePage } from '@inertiajs/react';
import { Globe, Server, Shield, Terminal } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { dashboard, login } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Beacon — Server Control Panel" />
            <div className="flex min-h-screen flex-col bg-background">
                <header className="border-b">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold tracking-tight">
                            <AppLogoIcon className="size-8" />
                            Beacon
                        </div>
                        <nav>
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="text-sm font-medium text-primary hover:underline"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <Link
                                    href={login()}
                                    className="text-sm font-medium text-primary hover:underline"
                                >
                                    Log in
                                </Link>
                            )}
                        </nav>
                    </div>
                </header>

                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-6 py-16">
                    <div className="max-w-2xl space-y-4">
                        <p className="text-sm font-medium text-muted-foreground">
                            Self-hosted server control panel
                        </p>
                        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                            Manage sites, PHP, databases, and deployments on
                            your own server.
                        </h1>
                        <p className="text-lg text-pretty text-muted-foreground">
                            Beacon provisions Nginx, PHP-FPM, MySQL, Redis,
                            Supervisor, and Let&apos;s Encrypt — without Docker
                            — from a modern React panel you install on Ubuntu.
                        </p>
                        {!auth.user && (
                            <Link
                                href={login()}
                                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
                            >
                                Sign in to the panel
                            </Link>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            {
                                icon: Globe,
                                title: 'Sites',
                                description:
                                    'Laravel, Next.js, Nuxt, and static sites with SSL and Nginx.',
                            },
                            {
                                icon: Terminal,
                                title: 'Deployments',
                                description:
                                    'Git push deploys, live build logs, and editable deploy scripts.',
                            },
                            {
                                icon: Server,
                                title: 'Stack',
                                description:
                                    'PHP versions, Node/Bun runtimes, databases, cron, and Supervisor.',
                            },
                            {
                                icon: Shield,
                                title: 'Hardened',
                                description:
                                    'Split panel/site users, sudo wrappers, and audit logging.',
                            },
                        ].map(({ icon: Icon, title, description }) => (
                            <div
                                key={title}
                                className="rounded-xl border bg-card p-5 text-card-foreground shadow-sm"
                            >
                                <Icon className="mb-3 size-5 text-muted-foreground" />
                                <h2 className="font-medium">{title}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        ))}
                    </div>
                </main>

                <footer className="border-t py-6 text-center text-sm text-muted-foreground">
                    Beacon — single-server PaaS for Ubuntu
                </footer>
            </div>
        </>
    );
}
