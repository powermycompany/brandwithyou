// app/(auth)/signin/page.tsx
import { Suspense } from "react";
import SignInClient from "./SignInClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-6 py-20 text-sm text-zinc-500">Loading sign-in…</div>}>
      <SignInClient />
    </Suspense>
  );
}
