import { cn } from '@/lib/utils';
import {
    siteFrameworkIconSrc,
    siteFrameworkLabel,
} from '@/lib/site-framework';

const sizeClasses = {
    sm: 'size-5',
    md: 'size-6',
    lg: 'size-8',
} as const;

export function SiteFrameworkIcon({
    type,
    size = 'md',
    className,
    alt,
}: {
    type: string;
    size?: keyof typeof sizeClasses;
    className?: string;
    alt?: string;
}) {
    const src = siteFrameworkIconSrc(type);

    if (!src) {
        return null;
    }

    return (
        <img
            src={src}
            alt={alt ?? siteFrameworkLabel(type)}
            className={cn('shrink-0', sizeClasses[size], className)}
            loading="lazy"
            decoding="async"
        />
    );
}
