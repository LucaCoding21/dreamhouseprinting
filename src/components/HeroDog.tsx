import Image from "next/image";

export default function HeroDog() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[380px] lg:max-w-none">
      <Image
        src="/services-hero.png"
        alt=""
        width={1200}
        height={1200}
        priority
        className="absolute inset-0 m-auto h-auto"
        style={{
          width: "350%",
          top: "60%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
