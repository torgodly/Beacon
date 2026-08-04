import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const beaconLogoSrc = '/assets/images/logo.png';

export default function AppLogoIcon({
    className,
    alt = 'Beacon',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src={beaconLogoSrc}
            alt={alt}
            className={cn('object-contain', className)}
            {...props}
        />
    );
}
