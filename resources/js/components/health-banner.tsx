import { usePage } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type HealthIssue = {
    severity: string;
    message: string;
};

type BeaconShared = {
    health: {
        healthy: boolean;
        issues: HealthIssue[];
    };
};

export function HealthBanner() {
    const { beacon } = usePage().props as { beacon?: BeaconShared };

    if (!beacon || beacon.health.healthy || beacon.health.issues.length === 0) {
        return null;
    }

    const critical = beacon.health.issues.filter(
        (issue) => issue.severity === 'critical',
    );

    return (
        <Alert variant={critical.length > 0 ? 'destructive' : 'default'}>
            <AlertTriangle className="size-4" />
            <AlertTitle>
                {critical.length > 0
                    ? 'Panel health check failed'
                    : 'Panel health warnings'}
            </AlertTitle>
            <AlertDescription>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                    {beacon.health.issues.map((issue) => (
                        <li key={issue.message}>{issue.message}</li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    );
}
