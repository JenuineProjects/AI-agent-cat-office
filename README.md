# Cat Office

Animated pixel-art cats that visualize AI agent activity in real time. Each AI agent (Claude Code session, subagent, etc.) gets its own cat in a virtual office. When agents read files, cats go to the bookshelf. When they write code, cats sit at desks and type. When idle, they wander, play, eat, or sleep.

Built with PixiJS, TypeScript, and WebSockets.

## How It Works

Cat Office watches for Claude Code JSONL transcript files in `~/.claude/projects/`. When a new session or subagent starts, a cat spawns in the office. Tool events from the transcript drive the cat's behavior:

| Agent Activity | Cat Behavior | Location |
|---|---|---|
| `Read` (files) | Reading | Bookshelf |
| `Write`, `Edit`, `Bash`, `WebFetch`, `WebSearch` | Typing | Desk |
| `Grep`, `Glob` | Searching | Bookshelf |
| Idle (no tools) | Sleeping, Playing, Eating | Cat bed, Cat tree, Food bowls |

Cats walk to the correct furniture, perform their action with animated sprites, and transition between states using a finite state machine.

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
git clone https://github.com/Jen-Builds/AI-agent-cat-office.git
cd AI-agent-cat-office
npm install
npm run build
npm start
```

Open http://localhost:3000 in your browser. Cats will appear automatically when Claude Code sessions are active.

### Development Mode

```bash
npm run dev
```

Runs the server and client with hot reload.

## Using With Your Own AI Agents

Cat Office detects any Claude Code activity automatically. To see cats in action:

1. Start Cat Office (`npm start`)
2. Open http://localhost:3000
3. Run Claude Code in any terminal — each session spawns a cat
4. Use the `Agent` tool to spawn subagents — each gets its own cat

### Custom Agent Names

Cats are auto-named from the agent's system prompt. If your prompt includes patterns like:
- `You are "HR Admin 1"`
- `You are the Designer`
- `Role: Researcher`

The cat will use that name instead of a default name.

### Example: Multi-Agent CV Screening

The repo includes an example of 5 AI agents screening CVs for a job role, each appearing as a named cat in the office. See the `AI Agents Example/` folder for the job description, CVs, and assessment outputs.

## Project Structure

```
cat-office/
  packages/
    shared/     # Types, constants, state machine (shared between server & client)
    server/     # WebSocket server, transcript watcher, cat agent logic
    client/     # PixiJS renderer, sprite animations, UI
```

## Configuration

Key timing constants in `packages/shared/src/constants.ts`:

| Constant | Default | Description |
|---|---|---|
| `WORK_IDLE_TIMEOUT` | 15s | Time before a working cat goes idle |
| `IDLE_SLEEP_TIMEOUT` | 60s | Time before an idle cat falls asleep |
| `IDLE_BEHAVIOR_INTERVAL` | 10s | How often idle cats consider doing something |
| `IDLE_BEHAVIOR_CHANCE` | 15% | Chance of random idle behavior per check |
| `CAT_SPEED` | 2 tiles/s | Walking speed |

## Tech Stack

- **Client:** PixiJS 8, React (toolbar), TypeScript, Vite
- **Server:** Node.js, WebSocket (ws), TypeScript
- **Shared:** State machine, types, constants

## License

MIT
