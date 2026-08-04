/** Shared Forge-style class recipes (Laravel Forge parity). */
export const forge = {
    canvas: 'bg-[#f8fafc] dark:bg-[#151718]',
    container: 'mx-auto w-full max-w-[1180px] px-4 sm:px-6',
    card: 'rounded-2xl border border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]',
    divide: 'divide-y divide-[#e2e8f0] dark:divide-[#2e3032]',
    text: 'text-sm text-[#334155] antialiased dark:text-[#e2e8f0]',
    muted: 'text-sm text-[#64748b] dark:text-[#94a3b8]',
    accent: '#18B69B',
    tabActive:
        'border-b-2 border-[#18B69B] text-[#0f172a] dark:text-[#f8fafc]',
    tabInactive:
        'border-b-2 border-transparent text-[#64748b] hover:text-[#334155] dark:text-[#94a3b8] dark:hover:text-[#e2e8f0]',
} as const;
