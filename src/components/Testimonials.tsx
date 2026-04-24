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
            className="flex flex-col rounded-2xl border border-dream-ink/5 bg-dream-cream/70 px-7 pb-7 pt-6"
          >
            <span
              aria-hidden="true"
              className="block font-display text-[56px] font-bold leading-none text-dream-purple"
            >
              &ldquo;
            </span>
            <p className="mx-auto mt-2 flex-1 max-w-[240px] text-center text-[13px] leading-[1.7] text-dream-ink-soft">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="mt-8 font-display text-[13px] font-bold text-dream-ink">
              {t.name}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
