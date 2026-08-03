import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function MetricCard({
    label,
    value,
    hint,
    icon: Icon,
    className,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    className?: string;
}) {
    return (
        <Card className={cn('gap-0 py-5', className)}>
            <CardContent className="flex items-start justify-between gap-4 px-5">
                <div className="space-y-1.5">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold tracking-tight">
                        {value}
                    </p>
                    {hint && (
                        <p className="text-xs text-muted-foreground">{hint}</p>
                    )}
                </div>

                {Icon && (
                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                        <Icon className="size-4" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
