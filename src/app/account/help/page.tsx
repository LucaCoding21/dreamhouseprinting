import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

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
          <p>3. Once you approve, we print and let you know when it’s ready.</p>
          <p className="pt-2">
            Questions? Email{" "}
            <a className="font-medium text-dream-purple" href="mailto:hello@dreamhouseprinting.com">
              hello@dreamhouseprinting.com
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
