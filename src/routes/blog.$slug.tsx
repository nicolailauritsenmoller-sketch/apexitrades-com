import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BlogCard, BlogCover, BlogShell } from "@/components/blog/BlogPresentation";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-content";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getBlogPost(params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.title ?? "Article unavailable"} | Velocity Trade Blog` },
    { name: "description", content: loaderData?.excerpt ?? "Browse the Velocity Trade Blog." },
    { property: "og:title", content: loaderData?.title ?? "Velocity Trade Blog" },
    { property: "og:description", content: loaderData?.excerpt ?? "Company news and perspectives." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: BlogArticle,
  notFoundComponent: () => <BlogShell><main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-3xl font-semibold">Article not found</h1><Link to="/blog" className="mt-6 inline-flex min-h-11 items-center gap-2 text-ops-section"><ArrowLeft className="size-4" /> Back to Blog</Link></main></BlogShell>,
});

function BlogArticle() {
  const post = Route.useLoaderData();
  return <BlogShell>
    <main>
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
        <Link to="/blog" className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All articles</Link>
        <p className="mt-5 text-xs font-medium text-ops-section">{post.category} / Editorial preview</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">{post.title}</h1>
        <div className="mt-5 text-xs text-muted-foreground"><p>{post.date}</p>{post.authors && <p className="mt-2">Reference author credit: {post.authors}</p>}</div>
        <div className="mt-7"><BlogCover post={post} featured={post.slug === "system-update-take-control"} /></div>
        <aside className="mt-7 border-l-2 border-border pl-4 text-xs leading-6 text-muted-foreground">This is an adapted editorial reference, not a verified company announcement. The supplied dates, authors, product launches, custody statements and financial claims are pending confirmation. Full approved article copy has not yet been supplied.</aside>
        <p className="mt-8 text-lg italic leading-7">{post.excerpt}</p>
        {post.body.map((section) => <section key={section.heading} className="mt-8"><h2 className="text-xl font-semibold">{section.heading}</h2><p className="mt-4 text-sm leading-7 text-muted-foreground">{section.text}</p></section>)}
      </article>
      <section className="border-t border-border bg-surface/50"><div className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><h2 className="mb-6 text-2xl font-semibold">More from the blog</h2><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 3).map((item) => <BlogCard key={item.slug} post={item} />)}</div></div></section>
    </main>
  </BlogShell>;
}