export interface OrderMonitoringSource {
    payment_status?: unknown;
    order_status?: unknown;
    lifecycle_status?: unknown;
    progress_status?: unknown;
    delivery_option?: unknown;
    biteship_order_id?: unknown;
}
export interface OrderMonitoringFlags {
    has_shipment: boolean;
    paid_without_shipment: boolean;
    lifecycle_mismatch: boolean;
    legacy_no_progress: boolean;
}
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export function deriveOrderMonitoringFlags(source: OrderMonitoringSource): OrderMonitoringFlags {
    const paymentStatus = asString(source.payment_status);
    const orderStatus = asString(source.order_status);
    const lifecycleStatus = asString(source.lifecycle_status);
    const progressStatus = asString(source.progress_status);
    const deliveryOption = asString(source.delivery_option);
    const biteshipOrderId = asString(source.biteship_order_id);
    const hasShipment = biteshipOrderId !== null;
    const paidWithoutShipment = paymentStatus === 'paid' && deliveryOption === 'delivery' && !hasShipment;
    const lifecycleMismatch = (lifecycleStatus === 'completed' && orderStatus !== 'completed') ||
        (lifecycleStatus === 'ongoing' && orderStatus === 'completed') ||
        (orderStatus === 'cancelled' && lifecycleStatus === 'ongoing');
    const legacyNoProgress = progressStatus === null;
    return {
        has_shipment: hasShipment,
        paid_without_shipment: paidWithoutShipment,
        lifecycle_mismatch: lifecycleMismatch,
        legacy_no_progress: legacyNoProgress,
    };
}
export function orderNeedsAttention(flags: OrderMonitoringFlags): boolean {
    return flags.paid_without_shipment || flags.lifecycle_mismatch;
}
