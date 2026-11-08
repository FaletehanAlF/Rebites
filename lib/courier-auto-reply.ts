export type ParticipantRole = 'buyer' | 'courier' | 'seller' | 'none';
export function resolveParticipantRole(args: {
    userId: string;
    buyerId: string | null | undefined;
    assignedCourierId: string | null | undefined;
    sellerUserIds?: ReadonlyArray<string | null | undefined>;
}): ParticipantRole {
    const { userId, buyerId, assignedCourierId, sellerUserIds = [] } = args;
    if (buyerId && buyerId === userId)
        return 'buyer';
    if (assignedCourierId && assignedCourierId === userId)
        return 'courier';
    if (sellerUserIds.some((id) => id && id === userId))
        return 'seller';
    return 'none';
}
export type AutoReplyMode = 'none' | 'ai' | 'fallback';
export function decideAutoReplyMode(args: {
    role: ParticipantRole;
    isDemoOrder: boolean;
    geminiConfigured: boolean;
}): AutoReplyMode {
    if (args.role !== 'buyer')
        return 'none';
    if (!args.isDemoOrder)
        return 'none';
    return args.geminiConfigured ? 'ai' : 'fallback';
}
export function autoReplySenderKind(mode: AutoReplyMode): 'ai_courier' | 'demo_courier' | null {
    if (mode === 'ai')
        return 'ai_courier';
    if (mode === 'fallback')
        return 'demo_courier';
    return null;
}
