import type { ReactNode } from 'react';
import type { AppVariant } from '@/types';

type Props = {
    children: ReactNode;
    variant?: AppVariant;
};

/** Legacy wrapper — v2 panel uses BeaconShell directly. Header variant kept for compat. */
export function AppShell({ children, variant: _variant = 'sidebar' }: Props) {
    return <>{children}</>;
}
