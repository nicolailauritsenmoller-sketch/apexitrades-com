import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SubPageHeader } from "@/components/profile/ui";
import { KycPanel } from "@/components/profile/KycPanel";
import { KycTierCard } from "@/components/profile/KycTierCard";
import { KycLevel2Panel, type Level2Payload } from "@/components/profile/KycLevel2Panel";
import { getMyKyc, submitKyc, submitKycLevel2 } from "@/lib/kyc.functions";
import { getProfileOverview } from "@/lib/profile.functions";
import { logActivity } from "@/lib/telemetry";

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
      { property: "og:title", content: "Account Verification - Velocity Trade" },
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
  const sendLevel2 = useServerFn(submitKycLevel2);


  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });

  const mutation = useMutation({
    mutationFn: (payload: KycPayload) => sendKyc({ data: payload }),
    onSuccess: (res) => {
      toast.success(res?.message ?? "Documents submitted for review");
      void logActivity("kyc", "Submitted KYC identity documents", { stage: "identity" });
      queryClient.invalidateQueries({ queryKey: ["my-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const level2Mutation = useMutation({
    mutationFn: (payload: Level2Payload) => sendLevel2({ data: payload }),
    onSuccess: (res) => {
      toast.success(res?.message ?? "Enhanced KYC documents submitted for review");
      void logActivity("kyc", "Submitted enhanced KYC documents", { stage: "enhanced" });
      queryClient.invalidateQueries({ queryKey: ["my-kyc"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = kyc.data?.status ?? "unverified";
  const needsResubmit = status === "rejected" || Boolean(kyc.data?.expired);
  const level1Status = kyc.data?.level1Status ?? "unverified";
  const level2Status = kyc.data?.level2Status ?? "unsubmitted";
  const userId = overview.data?.profile.id ?? null;

  return (
    <>
      <SubPageHeader
        title="Account verification"
        description="Verify your identity to enable withdrawals and higher limits."
      />

      <div className="space-y-4">
        <KycTierCard
          stage="identity"
          title="KYC Identity Verification"
          status={level1Status}
          requirements={[
            "Full name, date of birth and address",
            "Government ID, passport or driver's licence",
            "Selfie photo",
          ]}
        >
          <KycPanel
            kyc={kyc.data ?? null}
            userId={userId}
            needsResubmit={needsResubmit}
            onSubmit={async (payload) => {
              await mutation.mutateAsync(payload);
            }}
          />
        </KycTierCard>

        <KycTierCard
          stage="enhanced"
          title="Identity & Address Verification"
          status={level2Status}
          locked={level1Status !== "approved"}
          requirements={[
            "Approved KYC identity verification",
            "Live selfie / liveness check",
            "Proof of address or SSN / Tax ID",
          ]}
        >
          <KycLevel2Panel
            kyc={kyc.data ?? null}
            userId={userId}
            onSubmit={async (payload) => {
              await level2Mutation.mutateAsync(payload);
            }}
          />
        </KycTierCard>
      </div>
    </>
  );
}
