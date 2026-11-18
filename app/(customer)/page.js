// Home. U2 adds the search box and results here.
import Link from "next/link";
import { MapPin, ShoppingBasket, Store, Ticket } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HOLD_MINUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: MapPin,
    title: "Search near you",
    text: "Type a brand or generic name and see which pharmacies nearby have it.",
  },
  {
    icon: ShoppingBasket,
    title: "Reserve in one go",
    text: "Add the medicines you need from one pharmacy to your basket.",
  },
  {
    icon: Ticket,
    title: "Pick up with a code",
    text: `We hold them for ${HOLD_MINUTES} minutes. Show your pickup code at the counter.`,
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-primary px-5 py-10 text-primary-foreground md:px-10 md:py-14">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight md:text-4xl">
          Find your medicine at a pharmacy near you
        </h1>
        <p className="mt-3 max-w-xl text-primary-foreground/85">
          See which nearby shop actually has it in stock, reserve it, and pick
          it up. No more going shop to shop.
        </p>
        <div className="mt-6 rounded-xl bg-card p-4 text-sm text-muted-foreground">
          Medicine search arrives in the next step (U2).
        </div>
      </section>

      <section aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-4 text-lg font-semibold">
          How it works
        </h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Card className="h-full">
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Store className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">Own a pharmacy?</h2>
            <p className="text-sm text-muted-foreground">
              Run your stock here and get customers who already know you have
              what they need.
            </p>
          </div>
        </div>
        <Link
          href="/sign-in?as=pharmacy"
          className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}
        >
          Register your pharmacy
        </Link>
      </section>
    </div>
  );
}
