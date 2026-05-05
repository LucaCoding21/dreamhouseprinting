import Image from "next/image";

export default function HeroDog() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[380px] lg:max-w-none">
      <Image
        src="/hero-service.webp"
        alt=""
        width={1200}
        height={896}
        priority
        sizes="(min-width: 1024px) 600px, 100vw"
        className="absolute h-auto w-[120%] max-w-none lg:w-[130%]"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
