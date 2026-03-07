#!/bin/bash
# Demo script: simulates 4 Claude Code sessions with varied tool activity
PROJ_DIR=~/.claude/projects/C--Users-carey-Desktop-College-Masters-Customer-Engagement-and-AI-Projects-AIAgentsAnimation

# Clean old demo files
rm -f "$PROJ_DIR"/demo-agent-*.jsonl

TOOLS=("Write" "Edit" "Read" "Bash" "Grep" "Glob" "WebSearch" "WebFetch")

# Create 4 sessions
for i in 1 2 3 4; do
  FILE="$PROJ_DIR/demo-agent-${i}.jsonl"
  # Initial tool to spawn the cat
  case $i in
    1) echo '{"type":"tool_use","tool_name":"Write"}' > "$FILE" ;;
    2) echo '{"type":"tool_use","tool_name":"Read"}' > "$FILE" ;;
    3) echo '{"type":"tool_use","tool_name":"Grep"}' > "$FILE" ;;
    4) echo '{"type":"tool_use","tool_name":"Bash"}' > "$FILE" ;;
  esac
  sleep 1
done

echo "4 cats spawned. Sending periodic activity..."

# Send activity every 8 seconds, cycling through tools
cycle=0
while true; do
  for i in 1 2 3 4; do
    FILE="$PROJ_DIR/demo-agent-${i}.jsonl"
    # Each cat gets a different tool based on cycle + offset
    idx=$(( (cycle + i) % ${#TOOLS[@]} ))
    TOOL="${TOOLS[$idx]}"
    echo "{\"type\":\"tool_use\",\"tool_name\":\"$TOOL\"}" >> "$FILE"
  done
  cycle=$((cycle + 1))
  sleep 8
done
