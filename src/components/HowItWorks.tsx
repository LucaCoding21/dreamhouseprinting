import Image from "next/image";
import FrameSequence from "@/components/FrameSequence";

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
  // Optional vertical/horizontal nudge (CSS length) for when an asset's internal
  // composition doesn't center nicely inside the blob.
  dogOffsetY?: string;
  dogOffsetX?: string;
  // When true, dog is an animated asset (APNG) — skip Next.js optimization
  // so the animation survives.
  animated?: boolean;
  // When set, render a frame-by-frame PNG sequence instead of `dog`.
  // basePath should include the trailing prefix before the zero-padded index.
  frameSequence?: { basePath: string; count: number; fps?: number; start?: number; skip?: number[] };
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
    dogWidth: "500px",
    dogOffsetX: "30px",
    animated: true,
    frameSequence: {
      basePath: "/how it works/Step1V2/Timeline 1_",
      count: 118,
      fps: 24,
      start: 0,
    },
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
    dogWidth: "450px",
    dogOffsetY: "24px",
    animated: true,
    frameSequence: {
      basePath: "/how it works/Step2V2/step2_",
      count: 60,
      fps: 24,
      start: 0,
    },
  },
  {
    n: 3,
    title: "Printing begins",
    description: "Once you approve, we get to printing your order in-house.",
    blob: "/how it works/3blob.svg",
    blobWidth: 322,
    blobHeight: 299,
    dog: "/how it works/step3.apng",
    dogAlt: "Dog giving an approving thumbs up",
    dogWidth: "520px",
    dogOffsetY: "30px",
    animated: true,
    frameSequence: {
      basePath: "/how it works/Step3V2/Timeline 3_",
      count: 66,
      fps: 24,
      start: 0,
      skip: [12, 13],
    },
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
    dogWidth: "510px",
    animated: true,
    frameSequence: {
      basePath: "/how it works/Step4V2/Timeline 5_",
      count: 84,
      fps: 24,
      start: 0,
    },
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1550px] px-6 pb-32 pt-0 lg:px-10 lg:pb-40 lg:pt-0">
      <h2 className="mt-6 text-center font-display text-3xl font-bold text-dream-ink sm:text-4xl lg:mt-10">
        How It Works
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-base text-dream-ink-soft sm:text-lg">
        From idea to doorstep in four easy steps. Quote, proof, approve, and we deliver.
      </p>

      <div className="relative mt-4 grid gap-16 sm:grid-cols-2 sm:gap-20 md:mt-6 md:grid-cols-4 md:gap-20 lg:gap-28">
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          {[
            { i: 1, width: "13%", left: "24%", top: "90px", rotate: 0 },
            { i: 2, width: "17%", left: "53%", top: "115px", rotate: 4 },
            { i: 3, width: "13%", left: "81%", top: "90px", rotate: -10 },
          ].map(({ i, width, left, top, rotate }) => (
            <Image
              key={i}
              src={`/how it works/strokes/stroke${i}.png`}
              alt=""
              aria-hidden="true"
              width={300}
              height={120}
              className="absolute h-auto"
              style={{
                left,
                top,
                width,
                transform: `translateX(-50%) rotate(${rotate}deg)`,
              }}
            />
          ))}
        </div>

        {STEPS.map((step) => (
          <div
            key={step.n}
            className="relative flex flex-col items-center text-center"
          >
            <div className="relative flex h-[400px] w-full max-w-[460px] items-center justify-center sm:h-[440px]">
              {step.frameSequence ? (
                <FrameSequence
                  basePath={step.frameSequence.basePath}
                  count={step.frameSequence.count}
                  fps={step.frameSequence.fps}
                  start={step.frameSequence.start}
                  skip={step.frameSequence.skip}
                  alt={step.dogAlt}
                  className="relative z-10 h-auto max-w-none shrink-0"
                  style={{
                    width: step.dogWidth,
                    transform:
                      step.dogOffsetX || step.dogOffsetY
                        ? `translate(${step.dogOffsetX ?? "0"}, ${step.dogOffsetY ?? "0"})`
                        : undefined,
                  }}
                />
              ) : (
                <Image
                  src={step.dog}
                  alt={step.dogAlt}
                  width={460}
                  height={460}
                  unoptimized={step.animated}
                  className="relative z-10 h-auto"
                  style={{
                    width: step.dogWidth,
                    transform:
                      step.dogOffsetX || step.dogOffsetY
                        ? `translate(${step.dogOffsetX ?? "0"}, ${step.dogOffsetY ?? "0"})`
                        : undefined,
                  }}
                />
              )}
            </div>

            <h3 className="-mt-4 font-daruma text-2xl text-dream-ink sm:text-3xl">
              {step.title}
            </h3>

            <p className="mt-3 max-w-[320px] text-[14px] leading-relaxed text-dream-ink-soft">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
