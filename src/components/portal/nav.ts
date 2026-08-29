import { IconDashboard, IconOrders, IconDesigns, IconAccount, IconHelp } from "./icons";

/** Portal section links, shared by the desktop sidebar and the phone
 *  hamburger menu. */
export const PORTAL_NAV = [
  { label: "Dashboard", href: "/account", Icon: IconDashboard },
  { label: "My Orders", href: "/account/orders", Icon: IconOrders },
  { label: "My Designs", href: "/account/designs", Icon: IconDesigns },
  { label: "Account", href: "/account/settings", Icon: IconAccount },
  { label: "Help", href: "/account/help", Icon: IconHelp },
];

export function isNavActive(href: string, pathname: string): boolean {
  return href === "/account" ? pathname === "/account" : pathname.startsWith(href);
}
