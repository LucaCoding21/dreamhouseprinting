import { requirePermission } from "@/lib/auth";
import { getAdminOrders } from "@/lib/admin/orders";
import { OrdersListClient } from "./OrdersListClient";

export const metadata = { title: "Orders — Admin" };

export default async function AdminOrdersPage() {
  await requirePermission("orders.view");
  const orders = await getAdminOrders();
  // Serialize down to the client-friendly shape.
  const rows = orders.map((o) => ({
    id: o.order.id,
    orderNumber: o.order.order_number,
    status: o.order.status,
    paymentStatus: o.order.payment_status,
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
  return <OrdersListClient rows={rows} />;
}
