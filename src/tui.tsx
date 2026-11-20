import type { Plugin } from "@opencode/plugin/tui";
import { goalOperationLabel } from "./presentation.js";

export default {
  id: "local.native-goal-tools.tui",
  setup(context) {
    return context.ui.slot({
      append: "session.composer.top",
      render: ({ sessionID }) => {
        const label = () => goalOperationLabel(context.data.session.permission.list(sessionID)?.[0]);
        return <text>{label()}</text>;
      },
    });
  },
} satisfies Plugin.Definition;
