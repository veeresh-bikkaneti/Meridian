# team-board

A Claude Code plugin that shows which subagents are working, stuck, or silent, and whether
they message each other.

## What it does

- **A pane with one row per subagent.** Each row shows the agent's name and type, its state
  (`working`, `stuck`, `waiting`, `idle`, `completed`, `failed`, `killed`), how many tool calls
  it has made, how long ago the last one was, and how many messages it has sent. Stuck agents
  are listed first and drawn red; a `silent` agent is drawn yellow.
- **A stuck alert.** A subagent that is running but has made no tool call for 3 minutes
  raises one toast and shows `team-board: N stuck` in the status line. The next tool call
  clears it.
- **A silo warning.** Once agents have made 15 tool calls between them and none of them has sent
  a message, you get one toast and the pane footer turns yellow. The first message between
  agents clears the footer warning.
- **`/team` and `/team-board`.** Both open the pane and print the same board as text.

`silent` means an agent that is still alive, has made at least one tool call, and has sent no
message.

## Load it

```sh
claude --plugin-dir ./team-board
```

Check it first with `claude plugin validate ./team-board`.

## Limits

- **State is in memory.** The counts live in the module and start empty on a reload or a new
  session. Nothing is written to disk.
- **It only sees what the engine lists.** Agents come from `$.agent.list()`. A teammate running in
  a terminal pane of its own has no loop here, so its tool calls are not counted and it can look
  idle.
- **"Stuck" is a guess.** It means a running agent with no tool call for 3 minutes. One long tool
  call, or a long stretch of thinking, looks the same as being stuck. An agent the board first sees
  mid-run is timed from when it was first seen, up to 15 seconds late.
- **A "message between agents" is a send made from an agent's loop** (the SendMessage tool). The
  lead's own sends are not counted, and neither is who the message went to, so an agent
  messaging the lead counts.
- **The silo warning has no minimum team size.** A single subagent that makes 15 calls triggers it,
  because it cannot have messaged anyone.
- **Each alert fires once** per stuck spell (stuck) or per session (silo).
- **The thresholds are constants** at the top of `hooks/register.js` (3 minutes, 15 calls,
  15-second refresh); they are not configurable yet.
- **The pane needs a surface that seats panes.** Where none does, `/team` still prints the board
  as text.
