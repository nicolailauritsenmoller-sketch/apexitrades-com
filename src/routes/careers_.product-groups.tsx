import { createFileRoute } from "@tanstack/react-router";
import { CareersPage, careersHead } from "@/components/careers/CareersPage";
export const Route = createFileRoute("/careers_/product-groups")({ head: () => careersHead("Product Groups", "Explore markets technology, platform security and client operations at Velocity Trade."), component: ProductGroups });
function ProductGroups() { return <CareersPage view="product-groups" />; }