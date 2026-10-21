import { Browse } from "@/components/browse";
import { Footer } from "@/components/footer";
import { CATEGORIES, CHANNELS } from "@/data/channels";

export default function Home() {
  return (
    <>
      <Browse channels={CHANNELS} categories={CATEGORIES} />
      <Footer />
    </>
  );
}
