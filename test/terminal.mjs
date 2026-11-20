import headless from "@xterm/headless";

export function createScreen(columns = 120) {
  const terminal = new headless.Terminal({ cols: columns, rows: 40, scrollback: 0, allowProposedApi: true });
  return {
    write: chunk => new Promise(resolve => terminal.write(chunk, resolve)),
    text: () => Array.from({ length: terminal.rows }, (_, row) =>
      terminal.buffer.active.getLine(row)?.translateToString(true) ?? "").join("\n"),
    dispose: () => terminal.dispose(),
  };
}
