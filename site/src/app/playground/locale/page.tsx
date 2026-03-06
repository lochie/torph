import { Box } from "@/components/box";
import { LocaleDemo } from "@/surfaces/feature-demos/locales";

export default function Page() {
  return (
    <Box as="div" flexDirection="column" alignItems="stretch" gap={16}>
      <LocaleDemo />
    </Box>
  );
}
