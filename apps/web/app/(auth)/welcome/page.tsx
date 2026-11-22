import { Logo } from "@/components/app-bits";
import { Icon, type IconName } from "@/components/icons";
import { ButtonLink } from "@/components/ui";

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: "bag", title: "Buy, pick up or drop off", body: "Ask anyone heading to the market, a gate or a business centre to bring it back." },
  { icon: "lock", title: "Your money is held safely", body: "You only pay out when your handoff code is entered." },
  { icon: "route", title: "Earn on trips you already make", body: "Carry a request on your way and get paid into your wallet." },
];

export default function Welcome() {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col gap-6 px-6 pt-7">
        <Logo />
        <h1 className="font-display text-[30px] leading-[1.15] font-bold tracking-tight">
          Campus errands, carried by students already on the way
        </h1>
        <div className="flex flex-col gap-[18px]">
          {POINTS.map((p) => (
            <div key={p.title} className="flex items-start gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-soft text-navy"><Icon name={p.icon} /></span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[15.5px] font-bold">{p.title}</span>
                <span className="text-[14px] leading-[1.45] text-muted">{p.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-6 pt-6 pb-[max(30px,env(safe-area-inset-bottom))]">
        <ButtonLink href="/signup">Create an account</ButtonLink>
        <ButtonLink href="/login" variant="outline" className="text-navy">I already have an account</ButtonLink>
      </div>
    </main>
  );
}
