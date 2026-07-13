import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { CONTACT_PATH, SUPPORT_EMAIL, SUPPORT_MAILTO, SUPPORT_RESPONSE } from "@/lib/support";

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-dream-ink">Help</h1>
      <Card>
        <CardHeader>
          <CardTitle>How ordering works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-dream-muted">
          <p>1. Design your garment in the designer and place your order.</p>
          <p>2. We review your artwork and send a digital proof for approval.</p>
          <p>3. Once you approve, we print and let you know when it&rsquo;s ready.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Still have questions?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-dream-muted">
          <p>
            A real person is here to help with sizing, artwork, timing, or
            anything else. {SUPPORT_RESPONSE}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={CONTACT_PATH}
              className="inline-flex items-center justify-center rounded-full bg-dream-purple px-5 py-2.5 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Send us a message
            </Link>
            <a className="font-medium text-dream-purple hover:underline" href={SUPPORT_MAILTO}>
              or email {SUPPORT_EMAIL}
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
