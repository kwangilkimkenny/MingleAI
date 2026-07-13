/**
 * MiniGame dispatcher — renders the correct task component for a given AmongTaskKind.
 */
import type { AmongTaskKind } from "@mingle/shared";
import { Wires } from "./Wires";
import { Sequence } from "./Sequence";
import { Hold } from "./Hold";
import { Timing } from "./Timing";

export { Wires, Sequence, Hold, Timing };

export function MiniGame({
  kind,
  onComplete,
}: {
  kind: AmongTaskKind;
  onComplete: () => void;
}) {
  switch (kind) {
    case "wires":
      return <Wires onComplete={onComplete} />;
    case "sequence":
      return <Sequence onComplete={onComplete} />;
    case "hold":
      return <Hold onComplete={onComplete} />;
    case "timing":
      return <Timing onComplete={onComplete} />;
  }
}
