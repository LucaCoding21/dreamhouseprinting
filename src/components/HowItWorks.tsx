import Image from "next/image";

type Step = {
  n: number;
  title: string;
  description: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  dog: string;
  dogAlt: string;
  dogWidth: string;
  // Optional vertical nudge (CSS length) for when an asset's internal
  // composition doesn't center nicely inside the blob.
  dogOffsetY?: string;
  // When true, dog is an animated asset (APNG) — skip Next.js optimization
  // so the animation survives.
  animated?: boolean;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Order Created",
    description:
      "Pick your products, upload your artwork and choose your quantities. You'll get an instant quote and a mockup within 1 business day.",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    dog: "/how it works/step1.apng",
    dogAlt: "Dog sitting next to a folded shirt and paw-print food bowl",
    dogWidth: "160%",
    animated: true,
  },
  {
    n: 2,
    title: "Mockup Approved",
    description:
      "We'll send you a digital proof to review. Once you're happy with the design, colours, and placement, just hit approve and we'll get to work printing your order.",
    blob: "/how it works/2blob.svg",
    blobWidth: 317,
    blobHeight: 255,
    dog: "/how it works/step2.apng",
    dogAlt: "Dog peeking out of a canvas tote bag with rolled artwork",
    dogWidth: "105%",
    dogOffsetY: "24px",
    animated: true,
  },
  {
    n: 3,
    title: "Delivery / Pick Up",
    description:
      "Your order is printed, quality-checked, and packed with care. Choose free shipping to your door or swing by our Vancouver shop for local pickup.",
    blob: "/how it works/3blob.svg",
    blobWidth: 322,
    blobHeight: 299,
    dog: "/how it works/3dog.png",
    dogAlt: "Dog trotting with a shopping bag marked with a paw print",
    dogWidth: "68%",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-24">
      <h2 className="text-center font-display text-4xl font-bold text-dream-ink sm:text-5xl">
        How It Works
      </h2>

      <div className="relative mt-14 grid gap-12 md:mt-16 md:grid-cols-3 md:gap-6">
        <svg
          className="pointer-events-none absolute left-0 right-0 top-0 hidden h-[180px] w-full md:block"
          viewBox="0 0 1000 180"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 190 160 Q 335 -30 500 160 Q 665 -30 810 160"
            stroke="#1b1458"
            strokeWidth="6"
            strokeDasharray="0.1 18"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {STEPS.map((step) => (
          <div
            key={step.n}
            className="relative flex flex-col items-center text-center"
          >
            <div className="relative flex h-[260px] w-full max-w-[320px] items-center justify-center sm:h-[280px]">
              <Image
                src={step.blob}
                alt=""
                width={step.blobWidth}
                height={step.blobHeight}
                className="absolute inset-0 m-auto h-full w-full object-contain"
                aria-hidden="true"
              />
              <Image
                src={step.dog}
                alt={step.dogAlt}
                width={460}
                height={460}
                unoptimized={step.animated}
                className="relative z-10 h-auto"
                style={{
                  width: step.dogWidth,
                  transform: step.dogOffsetY
                    ? `translateY(${step.dogOffsetY})`
                    : undefined,
                }}
              />
            </div>

            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="relative flex h-10 w-10 items-center justify-center">
                <Image
                  src="/how it works/number-circle.svg"
                  alt=""
                  width={42}
                  height={43}
                  className="absolute inset-0 h-full w-full"
                  aria-hidden="true"
                />
                <span className="relative font-display text-base font-bold text-white">
                  {step.n}
                </span>
              </span>
              <h3 className="font-display text-xl font-bold text-dream-ink sm:text-2xl">
                {step.title}
              </h3>
            </div>

            <p className="mt-3 max-w-[320px] text-[14px] leading-relaxed text-dream-ink-soft">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
