import { Head } from '@inertiajs/react';
import AppearanceTabs from '@/components/appearance-tabs';
import { ForgeFormCard } from '@/components/forge/forge-form-card';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    return (
        <>
            <Head title="Appearance settings" />

            <h1 className="sr-only">Appearance settings</h1>

            <div className="flex flex-col gap-6">
                <ForgeFormCard
                    title="Appearance"
                    description="Update the appearance settings for your account"
                >
                    <AppearanceTabs />
                </ForgeFormCard>
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Appearance settings',
            href: editAppearance(),
        },
    ],
};
