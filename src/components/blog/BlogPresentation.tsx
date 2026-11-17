import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Building2, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import { BrandLockup } from "@/components/Logo";
import { SiteFooter } from "@/components/SiteFooter";
import type { BlogPost } from "@/lib/blog-content";
import editorialImage from "@/assets/blog-editorial.jpg";
import type { ReactNode } from "react";

export function BlogShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Velocity Trade homepage"><BrandLockup className="w-40 sm:w-44" /></Link>
        <Link to="/market" className="flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">Explore Markets <ArrowUpRight className="size-4" /></Link>
      </div>
    </header>
    <div className="border-b border-border"><div className="mx-auto flex h-12 max-w-6xl items-center px-4 sm:px-6"><Link to="/blog" className="text-sm font-semibold">Blog</Link><span className="ml-auto text-xs text-muted-foreground">News & perspectives</span></div></div>
    {children}
    <SiteFooter />
  </div>;
}

export function BlogCover({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  const Icon = post.category === "Security" ? ShieldCheck : post.category === "Institutional" ? Building2 : post.category === "Product" ? SlidersHorizontal : TrendingUp;
  return <div className={`relative w-full overflow-hidden rounded-lg border border-border ${featured ? "aspect-video sm:aspect-[16/7]" : "aspect-video"} bg-surface`}>
    {featured ? <img src={editorialImage} alt="Sculptural silver V with teal detailing" width={1536} height={864} className="absolute inset-0 h-full w-full object-cover" /> : <Icon className="absolute right-5 top-1/2 size-24 -translate-y-1/2 text-ops-section/20 sm:size-28" strokeWidth={0.7} />}
    <div className={`relative flex h-full flex-col justify-between p-6 sm:p-8 ${featured ? "max-w-[65%] text-help-foreground" : "text-foreground"}`}>
      <p className="text-[10px] font-semibold uppercase">Velocity Trade / {post.category}</p>
      <p className={`${featured ? "text-3xl sm:text-4xl" : "text-2xl"} max-w-60 font-display font-semibold leading-tight`}>{post.coverTitle}</p>
      <span className={`h-px w-9 ${featured ? "bg-help-foreground" : "bg-ops-section"}`} />
    </div>
  </div>;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return <article className="min-w-0">
    <Link to="/blog/$slug" params={{ slug: post.slug }} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
      <BlogCover post={post} />
      <h3 className="mt-5 text-xl font-semibold leading-snug group-hover:underline underline-offset-4">{post.title}</h3>
    </Link>
    {post.authors && <p className="mt-3 text-xs font-medium">{post.authors}</p>}
    <p className="mt-2 text-xs text-muted-foreground">{post.date}</p>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
    <p className="mt-4 text-[11px] font-medium text-ops-section">{post.category} <span className="text-muted-foreground">/ Editorial preview</span></p>
  </article>;
}