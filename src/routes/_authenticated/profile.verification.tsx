import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { KycPanel } from "@/components/profile/KycPanel";
import { getMyKyc, submitKyc } from "@/lib/kyc.functions";
import { getProfileOverview } from "@/lib/profile.functions";

type KycPayload = Parameters<Parameters<typeof KycPanel>[0]["onSubmit"]>[0];

export const Route = createFileRoute("/_authenticated/profile/verification")({
  head: () => ({
    meta: [
      { title: "Account Verification (KYC) | Velocity Trade" },
      {
        name: "description",
        content:
          "Submit your identity details and upload verification documents to unlock withdrawals on Velocity Trade.",
      },
      { property: "og:title", content: "Account Verification — Velocity Trade" },
      {
        property: "og:description",
        content: "Upload your identity document and selfie to complete verification.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  const queryClient = useQueryClient();
  const fetchKyc = useServerFn(getMyKyc);
  const fetchOverview = useServerFn(getProfileOverview);
  const sendKyc = useServerFn(submitKyc);

  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });

  const mutation = useMutation({
    mutationFn: (payload: KycPayload) => sendKyc({ data: payload }),
    onSuccess: (res) => {
      toast.success(res?.message ?? "Documents submitted for review");
      queryClient.invalidateQueries({ queryKey: ["my-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = kyc.data?.status ?? "unverified";
  const needsResubmit = status === "rejected" || Boolean(kyc.data?.expired);

  return (
    <>
      <SubPageHeader
        title="Account verification"
        description="Verify your identity to enable withdrawals and higher limits."
      />
      <Section
        icon={BadgeCheck}
        title="Identity verification"
        description="Government ID or passport plus a selfie. Reviews usually complete within 24 hours."
      >
        <KycPanel
          kyc={kyc.data ?? null}
          userId={overview.data?.profile.id ?? null}
          needsResubmit={needsResubmit}
          onSubmit={async (payload) => {
            await mutation.mutateAsync(payload);
          }}
        />
      </Section>
    </>
  );
}
