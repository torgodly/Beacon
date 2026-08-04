import type { CommandPalettePayload } from '@/components/command-palette';
import type { Auth } from '@/types/auth';

declare module 'react' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            commandPalette: CommandPalettePayload | null;
            flash?: {
                toast?: import('@/types/ui').FlashToast | null;
                database_user_password?: string | null;
            };
            [key: string]: unknown;
        };
    }
}
