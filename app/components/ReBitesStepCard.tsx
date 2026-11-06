import Image from "next/image";

export type Step = {
  title: string;
  description: string;
  image: string;
};

type ReBitesStepCardProps = {
  step: Step;
};

export default function ReBitesStepCard({ step }: ReBitesStepCardProps) {
  return (
    <div className="cursor-pointer overflow-hidden rounded-xl border border-border bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-2 hover:border-border hover:shadow-[0_20px_45px_-15px_rgba(27,77,50,0.35)]">
      <div className="relative h-[190px] w-full shrink-0 overflow-hidden">
        <Image
          src={step.image}
          alt={step.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col items-center px-5 pb-5 pt-5 text-center">
        <h3 className="font-display text-lg font-bold leading-snug text-primary-800">
          {step.title}
        </h3>
        <p className="mt-2.5 font-sans text-sm leading-[1.6] text-muted-foreground">
          {step.description}
        </p>
      </div>
    </div>
  );
}
