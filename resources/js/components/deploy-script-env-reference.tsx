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
    const [open, setOpen] = useState(false);

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <div className="overflow-hidden rounded-lg border border-[#e2e8f0] bg-[#f8fafc] dark:border-[#2e3032] dark:bg-[#151718]/40">
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        className="flex h-auto w-full items-center justify-between rounded-none px-4 py-2.5 text-left hover:bg-[#f1f5f9] dark:hover:bg-[#151718]"
                    >
                        <div>
                            <p className="text-sm font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                Environment variables
                            </p>
                            <p className="text-xs text-[#64748b]">
                                {variables.length} variables injected into every deploy run
                            </p>
                        </div>
                        {open ? (
                            <ChevronDown className="size-4 shrink-0 text-[#64748b]" />
                        ) : (
                            <ChevronRight className="size-4 shrink-0 text-[#64748b]" />
                        )}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="max-h-64 overflow-y-auto border-t border-[#e2e8f0] dark:border-[#2e3032]">
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-[#f8fafc] text-xs text-[#64748b] dark:bg-[#151718]">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Variable</th>
                                    <th className="px-4 py-2 font-medium">Description</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#2e3032]">
                                {variables.map((variable) => (
                                    <tr key={variable.name}>
                                        <td className="px-4 py-2 align-top font-mono text-xs text-[#0f172a] dark:text-[#f8fafc]">
                                            ${variable.name}
                                        </td>
                                        <td className="px-4 py-2 align-top text-[#64748b]">
                                            {variable.description}
                                            {variable.example && (
                                                <span className="mt-0.5 block font-mono text-xs text-[#94a3b8]">
                                                    e.g. {variable.example}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
