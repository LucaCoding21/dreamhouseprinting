type Testimonial = {
  quote: string;
  name: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Procured a large order of shirts, very pleased with the quality, service, and turnaround time. Would definitely order again!",
    name: "Teo Babienko",
  },
  {
    quote:
      "We got T-shirts printed from here for our event and I have to say that they are absolutely amazing. Prints came in no time and the quality is great.",
    name: "Ethan Bradford",
  },
  {
    quote:
      "Staff are very responsive and accommodating. High quality materials and great result, thanks!",
    name: "Torin Lang",
  },
];

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 pb-44 pt-28 lg:px-10 lg:pb-56 lg:pt-36">
      <h2 className="text-center font-display text-4xl font-bold text-dream-ink sm:text-5xl">
        What our clients say
      </h2>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <article
            key={t.name}
            className="group relative flex flex-col rounded-2xl border border-dream-ink/5 bg-dream-cream/70 px-8 pb-8 pt-20 shadow-[0_2px_0_0_rgba(27,20,88,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span
              aria-hidden="true"
              className="absolute left-6 top-6 font-display text-[72px] font-bold leading-none text-dream-purple/90"
            >
              &ldquo;
            </span>
            <p className="flex-1 text-[14.5px] leading-[1.75] text-dream-ink-soft">
              {t.quote}
            </p>
            <div className="mt-8 flex items-center gap-3 border-t border-dream-ink/10 pt-5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-dream-purple"
              />
              <span className="font-display text-[13px] font-bold uppercase tracking-wide text-dream-ink">
                {t.name}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
