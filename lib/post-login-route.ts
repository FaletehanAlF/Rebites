export interface PostLoginRouteInput {
    safeRedirect: string | null;
    sellerOnboardingTarget: string | null;
    roleHome: string;
    buyerHome: string;
    sellerHome: string;
    hasStore: boolean;
}
export function resolvePostLoginRoute(input: PostLoginRouteInput): string {
    if (input.safeRedirect)
        return input.safeRedirect;
    if (input.sellerOnboardingTarget)
        return input.sellerOnboardingTarget;
    if (input.hasStore && input.roleHome === input.buyerHome) {
        return input.sellerHome;
    }
    return input.roleHome;
}
