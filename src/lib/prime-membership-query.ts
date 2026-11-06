import { queryOptions } from "@tanstack/react-query";
import { getPrimeMembership } from "./prime-membership.functions";

export const membershipOptions = queryOptions({
  queryKey: ["prime-membership"],
  queryFn: () => getPrimeMembership(),
  refetchInterval: 5_000,
});