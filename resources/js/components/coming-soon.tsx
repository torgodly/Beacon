import type { LucideIcon } from 'lucide-react';

export function ComingSoon({
    icon: Icon,
    title,
    description,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
}) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
            <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Icon className="size-6" />
            </div>
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}
