import { Link } from "@tanstack/react-router";
import { ArrowRight, BriefcaseBusiness, Globe2, Trophy, Compass, Layers3, GraduationCap, MessageSquare, Sparkles } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import earth from "@/assets/careers/careers-earth.png.asset.json";
import { CareerSearch, FeaturedRoles, RolesDirectory } from "@/components/careers/CareerOpenings";
import type { CareerFilters } from "@/lib/careers-shared";

const navigation = [
  { label: "Home", to: "/careers" },
  { label: "View Roles", to: "/careers/roles" },
  { label: "Mission & Culture", to: "/careers/mission-culture" },
  { label: "Product Groups", to: "/careers/product-groups" },
  { label: "Internships", to: "/careers/internships" },
  { label: "How to Interview", to: "/careers/how-to-interview" },
  { label: "Extraordinary Ability", to: "/careers/extraordinary-ability" },
] as const;

const tenets = [
  { title: "Apolitical", icon: Compass, text: "Our work is focused on our mission. We respect different perspectives and keep unrelated political activism out of the workplace, creating space for constructive collaboration and progress." },
  { title: "Remote-first, not remote-only", icon: Globe2, text: "Great work can happen anywhere. Our remote-first approach values focused individual work and purposeful in-person collaboration. Location and travel expectations should be outlined for each role." },
  { title: "Championship team", icon: Trophy, text: "High standards, shared accountability and a commitment to getting better. We value people who bring deep expertise, give direct feedback and put the quality of the team's work first." },
];

export type CareersView = "overview" | "mission-culture" | "product-groups" | "internships" | "how-to-interview" | "extraordinary-ability" | "roles";

export function careersHead(title: string, description: string) {
  return { meta: [
    { title: `${title} | Velocity Trade Careers` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | Velocity Trade Careers` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}

function CultureCards() {
  return <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
    {tenets.map(({ title, icon: Icon, text }) => <article key={title} className="rounded-lg border border-border bg-surface p-7 text-left sm:p-8">
      <Icon className="mb-7 size-6 text-brand-teal" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{text}</p>
    </article>)}
  </div>;
}

export function CareersPage({ view = "overview", filters = {} }: { view?: CareersView; filters?: CareerFilters }) {
  const openRoles = <Button size="lg" className="h-12 rounded-full px-7" asChild><Link to="/careers/roles" search={{}}>View roles <ArrowRight /></Link></Button>;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/" aria-label="Velocity Trade home"><BrandLockup className="w-40 sm:w-44" /></Link>
        <Button variant="ghost" asChild><Link to="/">Back to platform <ArrowRight /></Link></Button>
      </div>
    </header>
    <nav aria-label="Careers sections" className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl flex-col px-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <Link to="/careers" className="py-3 text-lg font-semibold">Careers</Link>
        <div className="flex min-w-0 gap-5 overflow-x-auto sm:gap-4">
          {navigation.map(({ label, to }) => <Link key={to} to={to} activeOptions={{ exact: true }} activeProps={{ className: "border-brand-teal text-foreground" }} inactiveProps={{ className: "border-transparent text-muted-foreground" }} className="flex min-h-12 shrink-0 items-center border-b-2 text-xs font-semibold transition-colors hover:text-foreground">{label}</Link>)}
        </div>
      </div>
    </nav>
    <main>
      {view === "overview" ? <>
        <section className="careers-hero bg-careers-space text-careers-on-space">
          <img src={earth.url} alt="Earth at night, connected by the lights of cities across the globe" className="careers-hero-image" fetchPriority="high" />
          <div className="careers-hero-copy mx-auto max-w-6xl">
            <h1>A mission-first culture<br />built for the future.</h1>
            <p className="mb-4 mt-6 max-w-2xl text-sm leading-7 text-careers-space-muted">Velocity Trade is a team of builders and market technologists creating institutional-grade access to global markets.</p>
            <p className="mb-7 max-w-2xl text-sm leading-7 text-careers-space-muted">Ready to support the mission? Explore current openings across our teams.</p>
            {openRoles}
          </div>
          <div className="careers-search mx-auto max-w-6xl px-5"><CareerSearch /></div>
        </section>
        <FeaturedRoles />
        <section className="careers-section bg-surface text-center">
          <div className="mx-auto max-w-3xl"><h2>Who we are</h2>
            <p className="mt-6 text-sm leading-7 text-muted-foreground">We are builders, market technologists and problem-solvers. Our mission is to make financial markets more accessible through institutional-grade trading tools and multi-asset infrastructure.</p>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">From market data and execution to custody workflows and client experience, we believe thoughtful engineering, clear risk controls and trust belong at the foundation of finance.</p>
            <p className="mt-5 text-sm leading-7 text-muted-foreground">We are building for people who expect more from their trading platform.</p>
          </div>
        </section>
        <section className="careers-section text-center">
          <h2>Welcome to Velocity Trade</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-muted-foreground">Our cultural tenets describe how we collaborate, make decisions and pursue our mission. Ambitious work starts with a shared understanding of what matters.</p>
          <Button variant="secondary" size="lg" className="mt-6 h-12 rounded-full" asChild><Link to="/careers/mission-culture">Explore our culture <ArrowRight /></Link></Button>
          <CultureCards />
        </section>
        <section className="careers-section bg-muted/50 text-center">
          <h2>Alternative ways<br />to join the team</h2>
          <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2">
            <article className="rounded-lg border border-border bg-background p-7 text-left sm:p-9"><Sparkles className="mb-6 size-6 text-brand-teal" /><h3 className="text-lg font-semibold">Extraordinary ability</h3><p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">Have you built something extraordinary, but don't see a role that fits? Discover the kind of work and evidence that can help tell your story.</p><Button variant="secondary" className="h-11 rounded-full px-6" asChild><Link to="/careers/extraordinary-ability">Learn more <ArrowRight /></Link></Button></article>
            <article className="rounded-lg border border-border bg-background p-7 text-left sm:p-9"><BriefcaseBusiness className="mb-6 size-6 text-brand-teal" /><h3 className="text-lg font-semibold">Contract roles</h3><p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">Bring specialist expertise to focused projects across market technology, operations and client experience. Available contracts will include scope and location requirements.</p><Button variant="secondary" className="h-11 rounded-full px-6" asChild><Link to="/careers/roles" search={{ type: "Contract" }}>Find contract roles</Link> <ArrowRight /></Button></article>
          </div>
        </section>
      </> : view === "roles" ? <RolesDirectory filters={filters} /> : <CareersDetail view={view} />}
      <section className="careers-section bg-careers-banner text-center text-careers-on-banner"><h2 className="mx-auto max-w-2xl">Join our mission to build<br className="hidden sm:block" /> better access to global markets.</h2><div className="mt-7">{openRoles}</div></section>
      <section className="mx-auto max-w-4xl px-5 py-14 text-xs leading-6 text-muted-foreground" aria-label="Employment and candidate privacy">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Commitment to Equal Opportunity</h2>
        <p>Velocity Trade's proposed recruitment principles center on equal opportunity. Qualified applicants should be considered without regard to race, color, religion, national origin, age, disability, veteran status, sex, gender identity or expression, sexual orientation, or any other characteristic protected by applicable law. Employment decisions should be based on skills, experience and role requirements. Criminal histories should be considered only in a manner consistent with applicable law.</p>
        <p className="mt-4">Candidates who need a reasonable accommodation for any part of the recruitment process may contact Velocity Trade through the <Link to="/legal/$doc" params={{ doc: "contact" }} className="text-foreground underline underline-offset-4 hover:text-brand-teal">Contact page</Link>. Please describe the assistance needed without sharing unnecessary medical or sensitive information.</p>
        <h2 className="mb-4 mt-7 text-sm font-semibold text-foreground">Global Data Privacy Notice for Job Candidates and Applicants</h2>
        <p>Depending on your location, the GDPR, CCPA and other privacy laws may apply to candidate information. Before applications are collected, a recruitment-specific notice should explain the responsible entity, information collected, purposes and legal bases, service providers, international transfers, retention periods and available rights. These may include access, correction, deletion, objection or restriction, subject to applicable law. Applying for a role should not be treated as blanket consent to unrelated processing.</p>
        <p className="mt-4">Read the <Link to="/legal/$doc" params={{ doc: "privacy" }} className="text-foreground underline underline-offset-4 hover:text-brand-teal">Privacy Policy</Link> for existing platform privacy information. Recruitment policy details and this draft careers copy require confirmation before applications open. Applications are handled through the secure link listed on each opening.</p>
      </section>
    </main>
    <SiteFooter />
  </div>;
}

function CareersDetail({ view }: { view: Exclude<CareersView, "overview" | "roles"> }) {
  const detail = {
    "mission-culture": { title: "High standards. Shared purpose.", subtitle: "Mission & Culture", icon: Compass, text: "Build institutional-grade financial access with people who value rigorous thinking, clear communication and ownership. Our culture is focused on meaningful impact, not simply activity.", items: [["Own the outcome", "Take responsibility for the quality of your work. Make decisions thoughtfully, surface risks early and follow through."], ["Build trust", "Communicate clearly, protect client information and treat security and reliability as foundational requirements."], ["Keep improving", "Seek direct feedback, learn from evidence and make complex systems easier to understand."]] },
    "product-groups": { title: "Build the infrastructure behind the experience.", subtitle: "Product Groups", icon: Layers3, text: "Explore the disciplines behind Velocity Trade's multi-asset platform. These are areas of work, not advertised vacancies.", items: [["Markets & trading technology", "Market data, trading interfaces, execution workflows and tools for understanding risk."], ["Platform & security", "Reliable infrastructure, identity systems, secure account access and operational resilience."], ["Client experience & operations", "Clear product design, client support, compliance workflows and financial operations."]] },
    internships: { title: "Bring curiosity. Build your craft.", subtitle: "Internships", icon: GraduationCap, text: "Early-career work should combine meaningful projects, thoughtful mentorship and a chance to learn how financial technology is built. Internship dates, eligibility and locations have not yet been published.", items: [["Practical learning", "Explore engineering, product and market operations through real problems and measurable outcomes."], ["Prepare your portfolio", "Highlight projects, your specific contribution and what you learned from the work."], ["Program availability", "Verified internship opportunities will be listed with their requirements before applications open."]] },
    "how-to-interview": { title: "Show how you think. Show what you've built.", subtitle: "How to Interview", icon: MessageSquare, text: "Prepare to explain your work, the decisions behind it and how you collaborate. The exact interview process will be confirmed in each published role.", items: [["Know your work", "Be ready to discuss specific projects, trade-offs, challenges and the outcomes you can substantiate."], ["Understand the mission", "Consider how your discipline can improve trust, reliability and access in financial markets."], ["Ask thoughtful questions", "Explore the team's priorities, expectations and working practices. Request accommodations if needed."]] },
    "extraordinary-ability": { title: "Extraordinary work doesn't always fit a job title.", subtitle: "Extraordinary Ability", icon: Sparkles, text: "Breakthrough engineering, exceptional research and distinctive product work can speak for themselves. A dedicated application pathway has not yet opened.", items: [["Share evidence, not just ambition", "Prepare links to projects, research or public work that demonstrate an exceptional contribution."], ["Make your impact clear", "Explain what you built, the problem it solved and which outcomes can be independently verified."], ["Connect it to our mission", "Describe how your expertise could improve multi-asset infrastructure or the client experience."]] },
  }[view];
  const Icon = detail.icon;
  return <section className="careers-section"><div className="mx-auto max-w-6xl"><div className="mx-auto max-w-3xl text-center"><Icon className="mx-auto mb-5 size-8 text-brand-teal" /><p className="mb-4 text-xs font-semibold uppercase text-muted-foreground">{detail.subtitle}</p><h1 className="text-3xl font-semibold sm:text-4xl">{detail.title}</h1><p className="mt-6 text-sm leading-7 text-muted-foreground">{detail.text}</p></div>{view === "mission-culture" && <CultureCards />}<div className="mt-12 grid gap-7 md:grid-cols-3">{detail.items.map(([title, text]) => <article key={title} className="border-t border-border pt-6"><h2 className="text-lg! font-semibold">{title}</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{text}</p></article>)}</div><div className="mt-10 text-center"><Button size="lg" asChild><Link to="/careers/roles" search={{}}>View open roles <ArrowRight /></Link></Button></div></div></section>;
}