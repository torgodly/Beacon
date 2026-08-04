import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs,
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    children: React.ReactNode;
}) {
    const resolvedBreadcrumbs = Array.isArray(breadcrumbs) ? breadcrumbs : [];

    return (
        <AppLayoutTemplate breadcrumbs={resolvedBreadcrumbs}>
            {children}
        </AppLayoutTemplate>
    );
}
