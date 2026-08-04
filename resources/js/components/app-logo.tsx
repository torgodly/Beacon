import { usePage } from '@inertiajs/react';

import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    const { name } = usePage().props;

    return (
        <>
            <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-[#06C8E0] shadow-[0_0_12px_#06C8E0]">
                <AppLogoIcon className="size-5 fill-current text-[#05131E]" />
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className="mb-0.5 truncate leading-tight font-semibold text-[#1C2D3F] dark:text-[#E8EEF3]">
                    {name}
                </span>
            </div>
        </>
    );
}
