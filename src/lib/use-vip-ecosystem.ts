import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVipEcosystem } from "./vip-ecosystem.functions";
export function useVipEcosystem() { const load = useServerFn(getVipEcosystem); return useQuery({ queryKey: ["vip-ecosystem"], queryFn: () => load(), refetchInterval: 5_000 }); }