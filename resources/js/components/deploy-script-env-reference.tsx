import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

type EnvReferenceRow = {
    name: string;
    description: string;
    example: string | null;
};

export function DeployScriptEnvReference({
    variables,
}: {
    variables: EnvReferenceRow[];
}) {
    const [open, setOpen] = useState(true);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <div className="rounded-lg border bg-muted/20">
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className="flex h-auto w-full items-center justify-between px-4 py-3 text-left"
                    >
                        <div>
                            <p className="text-sm font-medium">
                                Environment variables
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Injected into every deploy script run
                            </p>
                        </div>
                        {open ? (
                            <ChevronDown className="size-4 shrink-0" />
                        ) : (
                            <ChevronRight className="size-4 shrink-0" />
                        )}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <ul className="divide-y border-t px-4 py-1">
                        {variables.map((variable) => (
                            <li
                                key={variable.name}
                                className="grid gap-1 py-2.5 text-sm"
                            >
                                <code className="w-fit rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                                    ${variable.name}
                                </code>
                                <p className="text-muted-foreground">
                                    {variable.description}
                                </p>
                                {variable.example && (
                                    <p className="font-mono text-xs text-muted-foreground">
                                        e.g. {variable.example}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
