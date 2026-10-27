// team-board: a pane with one row per subagent, a stuck alert, a silo warning, and the
// /team and /team-board commands. Nothing here touches game code or writes any file.
const PANE = "team-board";
const COMMANDS = ["team", "team-board"];
const STUCK_MS = 3 * 60 * 1000; // a running agent with no tool call for this long is stuck
const SILO_CALLS = 15; // this many tool calls with no agent-to-agent message is a silo
const TICK_MS = 15 * 1000; // how often the alerts are re-checked and the pane redrawn

// Module variables restart on a reload or a new session; the board starts empty then.
const seen = new Map(); // agent id -> { calls, lastActivity, sent, isStuck }
let messages = 0; // messages sent by agents so far
let isSiloWarned = false;
let timer;

function track(id, now) {
  let one = seen.get(id);
  if (!one) {
    one = { calls: 0, lastActivity: now, sent: 0, isStuck: false };
    seen.set(id, one);
  }
  return one;
}

function totalCalls() {
  let sum = 0;
  for (const one of seen.values()) sum += one.calls;
  return sum;
}

const isSilo = () => totalCalls() >= SILO_CALLS && messages === 0;

// One row per agent the engine lists, with what this module has counted for it.
async function snapshot($) {
  const [list, now] = await Promise.all([$.agent.list(), $.clock.now()]);
  const rows = list.map(info => {
    const one = track(info.id, now);
    const idleMs = now - one.lastActivity;
    const isLive = info.status === "running";
    const isStuck = isLive && idleMs >= STUCK_MS;
    const isOpen = isLive || info.status === "waiting" || info.status === "idle";
    return {
      id: info.id,
      name: info.name ?? info.description ?? info.id,
      type: info.type,
      label: isStuck ? "stuck" : isLive ? "working" : info.status,
      isStuck,
      isSilent: isOpen && one.calls > 0 && one.sent === 0,
      calls: one.calls,
      sent: one.sent,
      idleSec: Math.floor(idleMs / 1000),
    };
  });
  const rank = row => (row.isStuck ? 0 : row.label === "working" ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b));
}

const age = sec => (sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m${sec % 60}s`);

function describeRow(row) {
  const silent = row.isSilent ? " · silent" : "";
  return `${row.label}${silent} · ${row.calls} calls · last ${age(row.idleSec)} ago · ${row.sent} sent`;
}

function footer(rows) {
  if (rows.length === 0) return "No subagents yet.";
  if (isSilo()) {
    return `Silo: ${totalCalls()} tool calls and no messages between agents.`;
  }
  return `${messages} message${messages === 1 ? "" : "s"} between agents so far.`;
}

async function report($) {
  const rows = await snapshot($);
  const lines = rows.map(row => `${row.name} (${row.type}): ${describeRow(row)}`);
  return [...(lines.length ? lines : ["No subagents yet."]), footer(rows)].join("\n");
}

// Runs every TICK_MS: raises each alert once, keeps the status line, redraws the pane.
async function tick($) {
  const rows = await snapshot($);
  const parts = [];
  for (const row of rows) {
    const one = seen.get(row.id);
    if (row.isStuck && !one.isStuck) {
      one.isStuck = true; // alert once per stuck spell; the next tool call clears it
      $.ui.toast(`${row.name} looks stuck: no tool calls for 3 minutes`, { timeoutMs: 10000 });
    } else if (!row.isStuck) {
      one.isStuck = false;
    }
  }
  const stuckCount = rows.filter(row => row.isStuck).length;
  if (stuckCount) parts.push(`${stuckCount} stuck`);
  if (isSilo()) {
    parts.push("silo");
    if (!isSiloWarned) {
      isSiloWarned = true;
      $.ui.toast(`Agents have made ${totalCalls()} tool calls and sent no messages to each other`, { timeoutMs: 10000 });
    }
  }
  $.ui.status(parts.length ? `team-board: ${parts.join(", ")}` : undefined);
  $.ui.invalidate("ui.render");
}

export function register(on) {
  on("session.start", async ($, e, next) => {
    for (const name of COMMANDS) {
      await $.command.register({ name, description: "Show which subagents are working, stuck or silent" });
    }
    void $.ui.open({ id: PANE, title: "Team board" });
    timer?.cancel();
    timer = $.clock.every(TICK_MS, () => void tick($).catch(() => {}));
    return next(e);
  });

  on("session.end", async ($, e, next) => {
    timer?.cancel();
    timer = undefined;
    return next(e);
  });

  // A tool call made inside a subagent's loop carries that agent's id; the lead's has none.
  on("tool.call", async ($, e, next) => {
    if (e.agentId) {
      try {
        const now = await $.clock.now();
        const one = track(e.agentId, now);
        one.calls += 1;
        one.lastActivity = now;
        one.isStuck = false;
        $.ui.invalidate("ui.render");
      } catch {
        // The board is advisory: a failure here must never stop the tool call.
      }
    }
    return next(e);
  });

  // A send from an agent's loop is a message between agents. The lead's own sends carry
  // no agentId, so they are not counted.
  on("session.send", async ($, e, next) => {
    if (e.agentId) {
      try {
        const now = await $.clock.now();
        track(e.agentId, now).sent += 1;
        messages += 1;
        $.ui.invalidate("ui.render");
      } catch {
        // Advisory only.
      }
    }
    return next(e);
  });

  for (const command of COMMANDS) {
    on("command.run", { command }, async $ => {
      await $.ui.open({ id: PANE, title: "Team board" });
      return { text: await report($) };
    });
  }

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e);
    const rows = await snapshot($);
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 5);
    const color = row => (row.isStuck ? "red" : row.isSilent ? "yellow" : undefined);
    return h(
      Box,
      { flexDirection: "column" },
      h(Text, { bold: true }, "Team board"),
      rows.length === 0 && h(Text, { dimColor: true }, "No subagents yet."),
      ...rows.slice(0, room).map(row => h(Text, { color: color(row) }, `${row.name}: ${describeRow(row)}`)),
      h(Text, { dimColor: !isSilo(), color: isSilo() ? "yellow" : undefined }, footer(rows)),
    );
  });
}
