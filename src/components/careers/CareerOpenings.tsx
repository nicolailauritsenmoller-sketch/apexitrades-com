import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPublishedOpenings } from "@/lib/careers.functions";
import { EMPLOYMENT_TYPES, filterOpenings, type CareerFilters, type CareerOpening } from "@/lib/careers-shared";

export const openingsQuery = queryOptions({ queryKey: ["careers", "published"], queryFn: () => listPublishedOpenings(), staleTime: 60_000 });
const field = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function posted(value: string | null) {
  if (!value) return "Recently";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Today"; if (days === 1) return "Yesterday";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function isNew(value: string | null) { return !!value && Date.now() - new Date(value).getTime() < 14 * 86_400_000; }

export function CareerSearch({ initial = {}, compact = false }: { initial?: CareerFilters; compact?: boolean }) {
  const { data } = useSuspenseQuery(openingsQuery);
  const navigate = useNavigate();
  const [f, setF] = useState<CareerFilters>(initial);
  const countries = useMemo(() => [...new Set(data.map(r => r.country))].sort(), [data]);
  const groups = useMemo(() => [...new Set(data.map(r => r.business_group))].sort(), [data]);
  const set = (k: keyof CareerFilters, v: string) => setF(p => ({ ...p, [k]: v || undefined }));
  const submit = () => void navigate({ to: "/careers/roles", search: f });
  return <form onSubmit={e => { e.preventDefault(); submit(); }} className={compact ? "grid gap-4" : "grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.35fr_.8fr_1fr_.9fr_.9fr_auto]"} aria-label="Search careers">
    {compact ? <label className="grid gap-1.5 text-sm">Keywords<input className={field} value={f.q ?? ""} onChange={e => set("q", e.target.value)} placeholder="Search by title" /></label> : <input aria-label="Search by title" className={field} value={f.q ?? ""} onChange={e => set("q", e.target.value)} placeholder="Search by title" />}
    <Select label="Country" compact={compact} value={f.country} all="All countries" options={countries} onChange={v => set("country", v)} />
    {compact ? <label className="grid gap-1.5 text-sm">Job location<input className={field} value={f.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="City, region or remote" /></label> : <input aria-label="Job location" className={field} value={f.location ?? ""} onChange={e => set("location", e.target.value)} placeholder="Job location" />}
    <Select label="Job type" compact={compact} value={f.type} all="All job types" options={[...EMPLOYMENT_TYPES]} onChange={v => set("type", v)} />
    <Select label="Business groups" compact={compact} value={f.group} all="All business groups" options={groups} onChange={v => set("group", v)} />
    {compact ? <div className="grid grid-cols-2 gap-2"><Button type="button" variant="secondary" className="h-11 rounded-full" onClick={() => { setF({}); void navigate({ to: "/careers/roles", search: {} }); }}>Reset</Button><Button type="submit" className="h-11 rounded-full">Search</Button></div>
      : <Button type="submit" size="icon" className="size-11 rounded-full" aria-label="Search roles"><Search /></Button>}
  </form>;
}
function Select({ label, compact, value, all, options, onChange }: { label: string; compact: boolean; value?: string; all: string; options: string[]; onChange: (v: string) => void }) {
  const select = <select aria-label={label} className={field} value={value ?? ""} onChange={e => onChange(e.target.value)}><option value="">{all}</option>{options.map(o => <option key={o}>{o}</option>)}</select>;
  return compact ? <label className="grid gap-1.5 text-sm">{label}{select}</label> : select;
}

function Meta({ role }: { role: CareerOpening }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs"><span className="flex items-center gap-1.5"><MapPin className="size-4 text-brand-teal" />{role.location} ({role.work_mode})</span>{role.duration && <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-brand-teal" />{role.duration}</span>}<span className="text-muted-foreground">{role.employment_type}</span></div>;
}
function Tags({ tags, limit }: { tags: string[]; limit?: number }) {
  const shown = limit ? tags.slice(0, limit) : tags;
  return tags.length ? <div className="flex flex-wrap gap-2">{shown.map(t => <span key={t} className="rounded-sm bg-muted px-2 py-1 text-[11px] text-muted-foreground">{t}</span>)}{limit && tags.length > limit && <span className="rounded-sm bg-muted px-2 py-1 text-[11px]">+{tags.length - limit} more</span>}</div> : null;
}
function Apply({ role }: { role: CareerOpening }) {
  return <Button className="h-10 rounded-full px-6" asChild><a href={role.application_url} target="_blank" rel="noopener noreferrer">Apply now</a></Button>;
}

export function FeaturedRoles() {
  const { data } = useSuspenseQuery(openingsQuery);
  const roles = [...data.filter(r => r.featured), ...data.filter(r => !r.featured)].slice(0, 3);
  return <section className="careers-section bg-background"><div className="mx-auto max-w-6xl"><h2 className="text-left">Featured roles</h2>
    {roles.length ? <div className="mt-8 grid gap-4 md:grid-cols-3">{roles.map(role => <article key={role.id} className="relative flex min-h-72 flex-col gap-4 rounded-md border border-border border-l-4 border-l-brand-teal bg-card p-5">
      {isNew(role.published_at) && <span className="absolute right-0 top-0 bg-brand-teal px-2 py-1 text-[10px] font-bold text-background">NEW</span>}
      <p className="text-xs font-semibold text-brand-teal">{role.business_group}</p><h3 className="text-lg font-semibold leading-snug">{role.title}</h3><Meta role={role} /><Tags tags={role.tags} limit={4} />
      <div className="mt-auto flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">Posted: {posted(role.published_at)}</span><Apply role={role} /></div></article>)}</div>
      : <EmptyRoles />}
    <div className="mt-8 text-center"><Button size="lg" className="h-12 rounded-full" asChild><Link to="/careers/roles" search={{}}>View all roles <ArrowRight /></Link></Button></div></div></section>;
}
function EmptyRoles() { return <div className="mt-8 rounded-md border border-dashed border-border p-10 text-center"><BriefcaseBusiness className="mx-auto mb-4 size-7 text-brand-teal" /><h3 className="font-semibold">No openings are published right now</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">New opportunities will appear here as soon as they are posted.</p></div>; }

export function RolesDirectory({ filters }: { filters: CareerFilters }) {
  const { data } = useSuspenseQuery(openingsQuery);
  const [sort, setSort] = useState<"recent" | "title">("recent");
  const roles = filterOpenings(data, filters).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  return <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_1fr]">
    <aside className="h-fit rounded-md border border-border bg-card p-5 lg:sticky lg:top-20"><CareerSearch key={JSON.stringify(filters)} initial={filters} compact /></aside>
    <div><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Found <span className="font-semibold text-brand-teal">{roles.length}</span> {roles.length === 1 ? "job" : "jobs"}</p><select aria-label="Sort roles" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={sort} onChange={e => setSort(e.target.value as "recent" | "title")}><option value="recent">Most recent</option><option value="title">Title A-Z</option></select></div>
      {roles.length ? <div className="grid gap-4">{roles.map(role => <article key={role.id} className="rounded-md border border-border bg-card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="grid gap-3"><p className="text-xs text-muted-foreground">{role.business_group}</p><h2 className="text-lg font-semibold">{role.title}</h2><Meta role={role} /><Tags tags={role.tags} /></div><Apply role={role} /></div>
        <details className="mt-4 border-t border-border pt-4 text-sm"><summary className="cursor-pointer font-medium text-brand-teal">Role details</summary><p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">{role.description}</p>{role.requirements && <><h3 className="mt-4 font-semibold">Requirements</h3><p className="mt-2 whitespace-pre-line leading-7 text-muted-foreground">{role.requirements}</p></>}</details>
        <p className="mt-4 text-xs text-muted-foreground">Posted: {posted(role.published_at)}</p></article>)}</div> : <EmptyRoles />}
    </div></section>;
}
