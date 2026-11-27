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
      <div className="flex flex-1 flex-col gap-7 px-5 pt-[max(28px,env(safe-area-inset-top))]">
        <Logo />
        <h1 className="entrance font-display text-hero font-semibold text-balance">Campus errands, carried by students already on the way</h1>
        <div className="bento flex flex-col gap-1 p-2">
          {POINTS.map((p, i) => (
            <div key={p.title} className="entrance flex items-start gap-3.5 rounded-[18px] p-3" style={{ "--i": i + 1 } as React.CSSProperties}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card-nested text-foreground ring-1 ring-border dark:ring-glass-border">
                <Icon name={p.icon} className="size-[18px]" />
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{p.title}</span>
                <span className="text-[13.5px] leading-relaxed text-ink-2">{p.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-5 pt-6 pb-[max(28px,env(safe-area-inset-bottom))]">
        <ButtonLink href="/signup">Create an account</ButtonLink>
        <ButtonLink href="/login" variant="surface">I already have an account</ButtonLink>
      </div>
    </main>
  );
}
