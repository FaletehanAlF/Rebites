export type UserRole = 'admin' | 'umkm' | 'buyer';
export type OrderStatus = 'pending' | 'paid' | 'processing' | 'ready_for_pickup' | 'out_for_delivery' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'refunded';
export type DeliveryOption = 'delivery' | 'pickup';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';
export type ProductStatus = 'available' | 'sold_out' | 'hidden';
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';
export interface Profile {
    id: string;
    email: string;
    full_name: string | null;
    role: UserRole;
    phone: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    account_status: AccountStatus;
    created_at: string;
}
export interface UMKMProfile {
    id: string;
    user_id: string;
    business_name: string;
    description: string | null;
    category: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    logo_url: string | null;
    is_verified: boolean;
    rating: number;
    created_at: string;
}
export interface Product {
    id: string;
    umkm_id: string;
    name: string;
    description: string | null;
    category: string;
    original_price: number;
    surplus_price: number;
    stock: number;
    status: ProductStatus;
    image_url: string | null;
    sell_window_start: string | null;
    sell_window_end: string | null;
    is_delivery: boolean;
    is_pickup: boolean;
    created_at: string;
}
export interface Plan {
    id: string;
    name: string;
    price_monthly: number;
    price_yearly: number;
    max_products: number;
    features: string[];
    is_popular: boolean;
}
export interface Subscription {
    id: string;
    umkm_id: string;
    plan_id: string;
    status: SubscriptionStatus;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string;
}
export interface Order {
    id: string;
    buyer_id: string;
    umkm_id: string;
    product_id: string;
    quantity: number;
    total_price: number;
    delivery_option: DeliveryOption;
    delivery_address: string | null;
    note: string | null;
    payment_status: PaymentStatus;
    order_status: OrderStatus;
    created_at: string;
}
export interface OrderWithDetails extends Order {
    product?: Pick<Product, 'name' | 'image_url' | 'surplus_price'>;
    umkm?: Pick<UMKMProfile, 'business_name' | 'city'>;
    buyer?: Pick<Profile, 'full_name' | 'email'>;
}
export interface ProductWithUMKM extends Product {
    umkm: Pick<UMKMProfile, 'id' | 'business_name' | 'city' | 'rating'>;
}
export type AccountStatus = 'active' | 'suspended' | 'banned';
export type ActivityType = 'login' | 'register' | 'product_created' | 'product_updated' | 'product_deleted' | 'order_created' | 'order_cancelled' | 'store_updated' | 'subscription_changed' | 'report_received' | 'warning_received';
export interface ActivityLog {
    id: string;
    user_id: string | null;
    activity_type: ActivityType;
    description: string;
    target_type: string | null;
    target_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export interface UserReport {
    id: string;
    reported_user_id: string | null;
    reported_by: string | null;
    activity_id: string | null;
    category: string;
    description: string;
    status: ReportStatus;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
}
export type WarningLevel = 1 | 2 | 3;
export interface UserWarning {
    id: string;
    user_id: string | null;
    report_id: string | null;
    issued_by: string | null;
    warning_level: WarningLevel;
    category: string;
    reason: string;
    created_at: string;
}
export type SanctionType = 'suspend' | 'ban' | 'delete';
export interface UserSanction {
    id: string;
    user_id: string | null;
    warning_id: string | null;
    issued_by: string | null;
    sanction_type: SanctionType;
    reason: string;
    start_at: string;
    end_at: string | null;
    created_at: string;
}
export interface AdminAuditLog {
    id: string;
    admin_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    reason: string;
    metadata: Record<string, unknown>;
    created_at: string;
}
