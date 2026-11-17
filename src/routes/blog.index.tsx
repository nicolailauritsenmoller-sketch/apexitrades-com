import { createFileRoute, Link } from "@tanstack/react-router";
import { BlogCard, BlogCover, BlogShell } from "@/components/blog/BlogPresentation";
import { BLOG_POSTS } from "@/lib/blog-content";

export const Route = createFileRoute("/blog/")({
  head: () => ({ meta: [
    { title: "Velocity Trade Blog | Company News & Perspectives" },
    { name: "description", content: "Explore Velocity Trade's editorial previews, company updates, security perspectives and institutional insights." },
    { property: "og:title", content: "Velocity Trade Blog" },
    { property: "og:description", content: "Company updates, security perspectives and institutional insights from Velocity Trade." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: BlogIndex,
});

function BlogIndex() {
  const lead = BLOG_POSTS[0];
  const spotlight = BLOG_POSTS[1];
  return <BlogShell>
    <main>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Velocity Trade Blog</h1>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Editorial previews. Company claims and reference author credits are pending verification.</p>
        {lead && <article className="mt-8">
          <Link to="/blog/$slug" params={{ slug: lead.slug }} className="group block">
            <BlogCover post={lead} featured />
            <h2 className="mt-6 max-w-3xl text-2xl font-semibold leading-snug group-hover:underline underline-offset-4 sm:text-3xl">{lead.title}</h2>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">{lead.date}</p>
          <p className="mt-4 max-w-3xl text-sm italic leading-6 text-muted-foreground">{lead.excerpt}</p>
        </article>}
      </div>
      {spotlight && <section className="border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="mb-6 text-2xl font-semibold">Featured</h2>
          <div className="grid gap-8 md:grid-cols-2"><BlogCard post={spotlight} /><BlogCard post={BLOG_POSTS[4]} /></div>
        </div>
      </section>}
      <section className="bg-surface/50">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <h2 className="mb-7 text-2xl font-semibold">Most recent</h2>
          <div className="grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{BLOG_POSTS.slice(2).map((post) => <BlogCard key={post.slug} post={post} />)}</div>
        </div>
      </section>
    </main>
  </BlogShell>;
}