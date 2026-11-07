'use client';
import { ShipmentDetailView } from '@/app/components/admin/shipment-detail-view';
export default function AdminShipmentDetailPage({ params }: {
    params: {
        id: string;
    };
}) {
    return <ShipmentDetailView id={params.id}/>;
}
