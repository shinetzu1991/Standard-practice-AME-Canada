import Image from "next/image";

// "In partnership with" card. Always on white so the black logo text stays
// readable in dark mode too.
export default function PartnerBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-blue-200 dark:ring-slate-700 ${className}`}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        In partnership with
      </p>
      <Image
        src="/partners/aeronexa.png"
        alt="Aeronexa"
        width={600}
        height={120}
        className="mx-auto h-auto w-full max-w-[200px]"
      />
    </div>
  );
}
