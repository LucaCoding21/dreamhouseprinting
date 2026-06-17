import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

export default async function MyDesignsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: designs } = await supabase
    .from("designs")
    .select("id, product_id, status, mockup_images, created_at")
    .order("created_at", { ascending: false });

  const list = designs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-dream-ink">My designs</h1>
        <Link href="/shop">
          <Button variant="primary">Start a new design</Button>
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No saved designs" description="Designs you save in the designer show up here." />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((d) => {
            const mock = ((d.mockup_images ?? []) as { url: string | null }[]).find((m) => m.url)?.url;
            return (
              <Card key={d.id}>
                <CardContent className="p-3">
                  <div className="mb-2 flex h-36 items-center justify-center overflow-hidden rounded-lg bg-dream-bg">
                    {mock && <Image src={mock} alt="" width={140} height={140} className="h-full object-contain" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={d.status === "draft" ? "neutral" : "info"}>{d.status}</Badge>
                    <Link href={`/design/${d.product_id}?design=${d.id}`} className="text-sm font-medium text-dream-purple">
                      Open →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
