/** Discovery may preview any listing, but execution stays restricted to active catalog markets. */
export function listingAction(status: "listed" | "announced", supported: boolean): "terminal" | "preview" {
  return status === "listed" && supported ? "terminal" : "preview";
}