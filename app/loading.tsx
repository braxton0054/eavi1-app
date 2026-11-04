import Image from "next/image";
import { campuses } from "@/lib/campuses";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-8 bg-eavi-bg px-6 py-16 font-sans"
    >
      <div className="animate-eavi-rise flex flex-col items-center gap-6">
        <div className="shadow-eavi-card rounded-[28px] border border-eavi-border bg-eavi-plate p-6 sm:p-8">
          <Image
            src="/logo.png"
            alt="East Africa Vision Institute"
            width={240}
            height={225}
            priority
            className="h-auto w-[200px] sm:w-[240px]"
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-balance sm:text-4xl">
            East Africa Vision Institute
          </h1>
          <p className="text-sm text-eavi-text/75">Eldoret, Kenya</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-eavi-primary-text sm:text-xs">
          Leading the Leaders
        </p>
        <p className="text-sm text-eavi-secondary-text">
          Nurturing quality and affordable education.
        </p>
      </div>

      <div className="flex w-full max-w-[280px] flex-col items-center gap-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-eavi-muted">
          <span className="animate-eavi-load block h-full w-1/2 rounded-full bg-linear-to-r from-eavi-primary to-eavi-secondary motion-reduce:animate-none" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-eavi-text/75">
          Loading
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-3 pt-4 sm:grid-cols-3">
        {campuses.map((campus) => (
          <div
            key={campus.name}
            className="animate-eavi-fade motion-reduce:animate-none rounded-2xl border border-eavi-border bg-eavi-card p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-eavi-primary-text">
              {campus.name}
            </p>
            <p className="mt-1 text-xs leading-5 text-eavi-text/75">
              {campus.place}
            </p>
            <p className="mt-2 text-xs font-medium text-eavi-secondary-text">
              {campus.phone}
              {campus.note && (
                <span className="ml-2 font-normal text-eavi-text/75">
                  {campus.note}
                </span>
              )}
            </p>
            {campus.altPhone && (
              <p className="text-xs text-eavi-text/75">
                Alt: {campus.altPhone.phone}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
