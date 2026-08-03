import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SparklinePoint = {
    value: number;
};

export function MetricSparklineCard({
    label,
    value,
    hint,
    icon: Icon,
    data,
    color = 'emerald',
    className,
}: {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    data: SparklinePoint[];
    color?: 'emerald' | 'indigo' | 'violet' | 'amber';
    className?: string;
}) {
    const stroke =
        color === 'indigo'
            ? 'var(--color-indigo-500)'
            : color === 'violet'
              ? 'var(--color-violet-500)'
              : color === 'amber'
                ? 'var(--color-amber-500)'
                : 'var(--color-emerald-500)';

    const fillId = `metric-fill-${label.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <Card className={cn('gap-0 overflow-hidden py-0', className)}>
            <CardContent className="px-0 pb-0">
                <div className="flex items-start justify-between gap-4 px-5 pt-5">
                    <div className="space-y-1.5">
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-2xl font-semibold tracking-tight">
                            {value}
                        </p>
                        {hint && (
                            <p className="text-xs text-muted-foreground">
                                {hint}
                            </p>
                        )}
                    </div>

                    {Icon && (
                        <div className="rounded-md bg-muted p-2 text-muted-foreground">
                            <Icon className="size-4" />
                        </div>
                    )}
                </div>

                <div className="mt-4 h-16 w-full">
                    {data.length > 1 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient
                                        id={fillId}
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor={stroke}
                                            stopOpacity={0.35}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor={stroke}
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={['dataMin', 'dataMax']} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={stroke}
                                    strokeWidth={1.5}
                                    fill={`url(#${fillId})`}
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full border-t border-dashed bg-muted/20" />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
