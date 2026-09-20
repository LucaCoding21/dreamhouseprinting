import { getMyOrders } from "@/lib/db/orders";
import { OrdersList } from "@/components/portal/OrdersList";

export default async function MyOrdersPage() {
  const orders = await getMyOrders();

  return <OrdersList orders={orders} />;
}
