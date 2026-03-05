import { Box } from "@/components/box";
import { LocaleDemo } from "@/surfaces/feature-demos/locales";
import { Playground } from "@/surfaces/playground";

export default function Home() {
  return (
    <Box as="div" flexDirection="column" alignItems="stretch" gap={16}>
      <h1>Playground</h1>
      <Playground />
      <hr />
      <h1>Locale support</h1>
      <LocaleDemo />
    </Box>
  );
}
