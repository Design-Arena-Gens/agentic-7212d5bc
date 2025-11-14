import dynamic from "next/dynamic";

const ClientExperience = dynamic(
  () => import("@/components/FPSExperience").then((mod) => mod.FPSExperience),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <ClientExperience />
    </main>
  );
}
