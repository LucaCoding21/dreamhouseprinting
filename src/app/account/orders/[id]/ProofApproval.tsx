"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { approveProofAction, requestProofChangesAction } from "./actions";

interface ProofLite {
  id: string;
  image: string;
  status: string;
  change_request_comment: string | null;
}

export function ProofApproval({ proof }: { proof: ProofLite }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decided = proof.status === "approved";

  return (
    <Card className="border-dream-purple">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Your proof is ready</CardTitle>
        <Badge variant={proof.status === "approved" ? "success" : proof.status === "changes_requested" ? "warn" : "purple"}>
          {proof.status.replace(/_/g, " ")}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="h-48 w-48 shrink-0 overflow-hidden rounded-xl border border-dream-line bg-dream-bg">
            <Image src={proof.image} alt="Proof" width={192} height={192} className="h-full w-full object-contain" />
          </div>
          <div className="flex-1">
            {decided ? (
              <p className="text-sm text-dream-success">You approved this proof — it’s locked for production. 🎉</p>
            ) : (
              <>
                <p className="mb-3 text-sm text-dream-muted">
                  Review your mockup carefully — spelling, colours and placement. Approve to send it to production, or tell us what to change.
                </p>
                {!requesting ? (
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      loading={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await approveProofAction(proof.id);
                          if (r.error) setError(r.error);
                          else router.refresh();
                        })
                      }
                    >
                      Approve proof
                    </Button>
                    <Button variant="secondary" onClick={() => setRequesting(true)}>
                      Request changes
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="What would you like changed?"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        loading={pending}
                        onClick={() =>
                          start(async () => {
                            const r = await requestProofChangesAction(proof.id, comment);
                            if (r.error) setError(r.error);
                            else router.refresh();
                          })
                        }
                      >
                        Send request
                      </Button>
                      <Button variant="ghost" onClick={() => setRequesting(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {proof.change_request_comment && (
                  <p className="mt-2 text-sm text-dream-warn">You asked: “{proof.change_request_comment}”</p>
                )}
                {error && <p className="mt-2 text-sm text-dream-danger">{error}</p>}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
