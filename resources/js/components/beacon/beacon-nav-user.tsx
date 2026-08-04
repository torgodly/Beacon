import { usePage } from '@inertiajs/react';
import { ChevronsUpDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';

export function BeaconNavUser({ expanded = false }: { expanded?: boolean }) {
    const { auth } = usePage().props;
    const getInitials = useInitials();

    if (!auth.user) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={
                        expanded
                            ? 'flex w-full items-center gap-3 rounded-xl border border-[#E8EEF3] bg-white px-3 py-2 text-left dark:border-[#263647] dark:bg-[#1C2D3F]'
                            : 'flex size-11 items-center justify-center rounded-xl border border-[#E8EEF3] bg-[#F5F8FA] dark:border-[#263647] dark:bg-[#1C2D3F]'
                    }
                    data-test="sidebar-menu-button"
                >
                    <Avatar className="size-8 shrink-0">
                        <AvatarImage src={auth.user.avatar} alt={auth.user.name} />
                        <AvatarFallback className="bg-[#ECFDFF] text-[11px] font-semibold text-[#04A3BC] dark:bg-[#063543] dark:text-[#22D0E8]">
                            {getInitials(auth.user.name)}
                        </AvatarFallback>
                    </Avatar>
                    {expanded && (
                        <>
                            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1C2D3F] dark:text-[#E8EEF3]">
                                {auth.user.name}
                            </span>
                            <ChevronsUpDown className="size-4 shrink-0 text-[#8095A8]" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="right" className="min-w-56 rounded-xl">
                <UserMenuContent user={auth.user} />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
