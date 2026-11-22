import Link from "next/link";

export default function Splash() {
  return (
    <main className="flex min-h-dvh flex-col bg-navy text-white">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark-white.svg" alt="" className="h-[104px] w-auto" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/wordmark-white.svg" alt="299 Relay" className="h-[74px] w-auto" />
        <p className="text-base tracking-[2px] text-mist">Together, we move.</p>
      </div>
      <div className="flex flex-col gap-3 px-6 pb-[max(34px,env(safe-area-inset-bottom))]">
        <Link href="/welcome" className="flex min-h-[54px] items-center justify-center rounded-[14px] bg-orange text-base font-bold text-navy no-underline">
          Get started
        </Link>
        <span className="text-center text-[12.5px] text-mist">Starting at ABU Zaria</span>
      </div>
    </main>
  );
}
