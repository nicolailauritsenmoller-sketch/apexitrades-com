import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ADMIN_HOST } from "@/lib/operations-routing";

export const getSiteHost = createServerFn({ method: "GET" }).handler(() => ({
  admin: new URL(getRequest().url).hostname === ADMIN_HOST,
}));