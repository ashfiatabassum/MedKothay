// Placeholder home page for the day-one deploy. Customer search replaces it later.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">MedKothay</h1>
      <p className="text-muted-foreground">
        Find which nearby pharmacy has your medicine, and reserve it for pickup.
      </p>
      <p className="text-sm text-muted-foreground">
        Under construction. Status check:{" "}
        <a className="underline underline-offset-4" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
