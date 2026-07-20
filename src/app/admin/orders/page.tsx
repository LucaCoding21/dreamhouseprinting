import { requirePermission } from "@/lib/auth";
import { getAdminOrders } from "@/lib/admin/orders";
import { OrdersListClient } from "./OrdersListClient";

export const metadata = { title: "Orders | Admin" };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Permission gate and data race in parallel; the gate redirects before render.
  const [, { tab }, orders] = await Promise.all([
    requirePermission("orders.view"),
    searchParams,
    getAdminOrders(),
  ]);
  // Serialize down to the client-friendly shape.
  const rows = orders.map((o) => ({
    id: o.order.id,
    orderNumber: o.order.order_number,
    status: o.order.status,
    isRush: (o.order.shipping_method ?? "") === "rush",
    paymentStatus: o.order.payment_status,
    paymentMethod: o.order.payment_method,
    etransferReportedAt: o.order.etransfer_reported_at,
    invoiceSentAt: o.order.invoice_sent_at,
    paidAt: o.order.paid_at,
    dueDate: o.order.due_date,
    createdAt: o.order.created_at,
    salesRep: o.order.sales_rep,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    pieces: o.pieces,
    total: o.total,
    mockups: o.mockups.slice(0, 3),
    latestNote: o.latestNote,
  }));
  return <OrdersListClient rows={rows} initialTab={tab} />;
}
