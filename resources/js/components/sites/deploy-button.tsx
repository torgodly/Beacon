import { Link, router } from '@inertiajs/react';
import { Play, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { show } from '@/routes/sites';
import { store as storeDeployment } from '@/routes/sites/deployments';

type DeployButtonProps = {
    siteId: string;
    repository: string | null;
    deploymentStatus?: string;
    size?: 'default' | 'sm' | 'lg';
    variant?: 'primary' | 'outline';
    className?: string;
};

export function DeployButton({
    siteId,
    repository,
    deploymentStatus,
    size = 'default',
    variant = 'primary',
    className,
}: DeployButtonProps) {
    const isDeploying =
        deploymentStatus === 'running' || deploymentStatus === 'queued';
    const hasRepository = Boolean(repository);

    if (!hasRepository) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size={size}
                        className={className}
                        asChild
                    >
                        <Link
                            href={show.url(siteId, {
                                query: { tab: 'settings' },
                            })}
                        >
                            <Settings />
                            Connect repository
                        </Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    Add a Git repository in Settings before deploying.
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            disabled={isDeploying}
            onClick={() =>
                router.post(
                    storeDeployment.url(siteId),
                    {},
                    { preserveScroll: true },
                )
            }
        >
            {isDeploying ? (
                <Spinner tone="progress" className="size-4" />
            ) : (
                <Play />
            )}
            {isDeploying ? 'Deploying…' : 'Deploy'}
        </Button>
    );
}
