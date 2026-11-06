import { submitInquiry } from "@/app/actions";
import { getPublicSiteData } from "@/lib/data";
import { ArrowRight, BadgeCheck, Building2, Clock3, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

export const instant = false;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const searchParamsPromise: Promise<{ status?: string }> = searchParams ?? Promise.resolve({});
  const [{ projects, properties }, params] = await Promise.all([
    getPublicSiteData(),
    searchParamsPromise,
  ]);
  const inquiryStatus = params.status === "success" || params.status === "duplicate"
    ? params.status
    : null;

  return (
    <main className="bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-lg font-semibold tracking-[0.12em] text-amber-300">DREAM LAND</p>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Properties</p>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-slate-200 md:flex">
            <Link href="/">Home</Link>
            <Link href="#projects">Projects</Link>
            <Link href="#properties">Properties</Link>
            <Link href="#contact">Contact</Link>
            <Link href="/dashboard" className="rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-amber-200">
              CRM Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-[radial-gradient(circle_at_top,_rgba(202,161,83,0.20),transparent_30%),linear-gradient(135deg,#0f172a,#111827_40%,#1e293b)] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted regional real estate partner
            </div>
            <h1 className="max-w-xl text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
              Properties within <span className="text-amber-300">your budget.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-300">
              Discover premium residential and investment opportunities across Lahore, Islamabad, Murree and Gwadar with a trusted team of property advisors.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="#projects" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 font-medium text-slate-950 hover:bg-amber-300">
                Explore projects <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#contact" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-medium text-white hover:bg-white/5">
                Schedule a visit
              </Link>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-2xl font-semibold text-amber-300">7+ Years</p>
                <p className="text-slate-300">Industry experience</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-amber-300">Lahore</p>
                <p className="text-slate-300">Based in Pakistan</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-amber-300">4 regions</p>
                <p className="text-slate-300">Lahore to Gwadar</p>
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-emerald-500/20 p-2 text-emerald-300">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-300">Free consultation</p>
                <p className="font-semibold text-white">Talk with an advisor</p>
              </div>
            </div>

            {inquiryStatus ? (
              <p role="status" className={`mb-4 rounded-xl border px-4 py-3 text-sm ${inquiryStatus === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                {inquiryStatus === "success"
                  ? "Thank you. Your inquiry has been received and our team will be in touch."
                  : "We already have an inquiry with those contact details. Our team will follow up soon."}
              </p>
            ) : null}

            <form action={submitInquiry} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <input name="fullName" placeholder="Full name" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
                <input name="phone" placeholder="Phone number" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input name="email" type="email" placeholder="Email" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
                <input name="city" placeholder="Preferred city" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input name="project" placeholder="Project or property" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
                <input name="budget" type="number" placeholder="Budget" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input name="whatsapp" type="tel" placeholder="WhatsApp number (optional)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
                <input name="propertySize" placeholder="Preferred size (optional)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              </div>
              <input name="investmentGoal" placeholder="Investment goal (optional)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              <textarea name="message" rows={4} placeholder="Share your investment goals" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-400" />
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 font-semibold text-slate-950">
                Request consultation
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Why Dream Land</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Confidence, trust and premium support.</h2>
          </div>
          <BadgeCheck className="h-8 w-8 text-amber-500" />
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {[
            { icon: Building2, title: "Premium projects", text: "Curated developments across the most promising locations." },
            { icon: TrendingUp, title: "Investment guidance", text: "Data-backed recommendations for buyers and investors." },
            { icon: ShieldCheck, title: "Transparent process", text: "Clear documentation, pricing and payment milestones." },
            { icon: MessageCircle, title: "Fast communication", text: "Swift WhatsApp support for every stage of the deal." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="bg-slate-100 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Featured projects</p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">Investment opportunities worth exploring</h2>
            </div>
            <Link href="/dashboard/projects" className="text-sm font-semibold text-sky-700">View in CRM</Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {projects.map((project) => (
              <article key={project.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <img src={project.image ?? "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80"} alt={project.name} className="h-52 w-full object-cover" />
                <div className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{project.city}</p>
                    {project.featured ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">Featured</span> : null}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-slate-900">{project.name}</h3>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {project.location}
                  </p>
                  <p className="mt-4 line-clamp-3 text-sm text-slate-600">{project.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="properties" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Available inventory</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Handpicked residential and commercial opportunities</h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <article key={property.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <img src={property.image ?? "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80"} alt={property.title} className="h-56 w-full object-cover" />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">{property.propertyType}</span>
                  <span className="text-sm font-semibold text-slate-800">{property.availability}</span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">{property.title}</h3>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <span>{property.size}</span>
                  <span>{property.location}</span>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">From</p>
                    <p className="text-lg font-semibold text-slate-900">{formatCurrency(property.price)}</p>
                  </div>
                  <Link href="#contact" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white">Enquire</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="bg-slate-950 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Contact us</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Let us help you shortlist the right property.</h2>
            <div className="mt-8 space-y-4 text-slate-300">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-amber-300" />
                <span>+92 321 9966843</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-amber-300" />
                <span>Lahore, Pakistan</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-amber-300" />
                <span>Mon-Sat: 9:00 AM - 8:00 PM</span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Speak with our team</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">A local advisor, from first question to closing.</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Call Dream Land Properties in Lahore or message us on WhatsApp to discuss your requirements.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="tel:+923219966843" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950">
                <Phone className="h-4 w-4" /> +92 321 9966843
              </a>
              <a href="https://wa.me/923219966843" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
