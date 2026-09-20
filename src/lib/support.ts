// Single source of truth for how customers reach us. Keep support copy and the
// contact address here so every surface stays consistent (no more hello@ vs
// admin@ drift, and the response-time promise only changes in one place).

export const SUPPORT_EMAIL = "admin@dreamhouseprinting.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

/** Where every "need help" prompt sends people. The public contact form. */
export const CONTACT_PATH = "/contact";

/** Plain-language turnaround promise. Julian is usually online through the day
 *  and answers fast; keep this honest and easy to change in one spot. */
export const SUPPORT_RESPONSE = "We usually reply within a couple of hours.";
