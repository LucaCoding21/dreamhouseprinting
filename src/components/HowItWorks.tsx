import Image from "next/image";

type Step = {
  n: number;
  title: string;
  description: string;
  blob: string;
  blobWidth: number;
  blobHeight: number;
  // Rotation applied to the blob only (in degrees)
  blobRotate?: number;
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
    title: "Tell us what you need",
    description:
      "Pick your products, upload your art and get an instant quote.",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    blobRotate: -12,
    dog: "/how it works/step1.apng",
    dogAlt: "Dog sitting next to a folded shirt and paw-print food bowl",
    dogWidth: "280%",
    animated: true,
  },
  {
    n: 2,
    title: "We send you a proof",
    description:
      "We'll design your mockup and send it over within 1 business day.",
    blob: "/how it works/2blob.svg",
    blobWidth: 317,
    blobHeight: 255,
    dog: "/how it works/step2.apng",
    dogAlt: "Dog peeking out of a canvas tote bag with rolled artwork",
    dogWidth: "320%",
    dogOffsetY: "24px",
    animated: true,
  },
  {
    n: 3,
    title: "You give the thumbs up",
    description: "Love it? Hit approve and we start printing!",
    blob: "/how it works/3blob.svg",
    blobWidth: 322,
    blobHeight: 299,
    dog: "/how it works/step3.apng",
    dogAlt: "Dog giving an approving thumbs up",
    dogWidth: "320%",
    animated: true,
  },
  {
    n: 4,
    title: "It's at your door",
    description:
      "Printed, packed and shipped, or grab it in Vancouver!",
    blob: "/how it works/1blob.svg",
    blobWidth: 255,
    blobHeight: 310,
    dog: "/how it works/step4-v2.apng",
    dogAlt: "Dog trotting with a shopping bag marked with a paw print",
    dogWidth: "70%",
    animated: true,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1550px] px-6 pb-32 pt-0 lg:px-10 lg:pb-40 lg:pt-0">
      <h2 className="mt-20 text-center font-display text-3xl font-bold text-dream-ink sm:text-4xl lg:mt-32">
        How It Works
      </h2>

      <div className="relative mt-14 grid gap-16 sm:grid-cols-2 sm:gap-14 md:mt-16 md:grid-cols-4 md:gap-10 lg:gap-14">
        <svg
          className="hiw-line pointer-events-none absolute left-0 right-0 top-0 hidden h-[260px] w-full md:block"
          viewBox="0 0 1000 260"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 125 120 C 185 30 295 30 375 120 C 455 260 545 260 625 120 C 705 30 815 30 875 120"
            stroke="#1b1458"
            strokeWidth="4"
            strokeDasharray="14 10"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {STEPS.map((step) => (
          <div
            key={step.n}
            className="relative flex flex-col items-center text-center"
          >
            <div className="relative flex h-[400px] w-full max-w-[460px] items-center justify-center sm:h-[440px]">
              <Image
                src={step.blob}
                alt=""
                width={step.blobWidth}
                height={step.blobHeight}
                className="absolute inset-0 m-auto h-[72%] w-[72%] object-contain"
                style={
                  step.blobRotate
                    ? { transform: `rotate(${step.blobRotate}deg)` }
                    : undefined
                }
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

            <div className="-mt-8 flex items-center justify-center gap-3">
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
