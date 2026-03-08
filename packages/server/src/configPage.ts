export const CONFIG_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cat Office - Agent Names</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1a1a2e;
      color: #eee;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #888;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .info {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #aaa;
      line-height: 1.5;
    }
    .agent-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }
    .agent-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px 16px;
    }
    .agent-number {
      font-size: 14px;
      font-weight: bold;
      color: #88ff88;
      min-width: 70px;
    }
    .name-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    .name-input:focus {
      border-color: #88ff88;
    }
    .name-input::placeholder {
      color: #555;
      font-style: italic;
    }
    .buttons {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .save-btn {
      padding: 10px 24px;
      background: #88ff88;
      color: #1a1a2e;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    }
    .save-btn:hover { background: #66dd66; }
    .back-link {
      color: #88aaff;
      text-decoration: none;
      font-size: 14px;
    }
    .back-link:hover { text-decoration: underline; }
    .status {
      font-size: 13px;
      color: #88ff88;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .status.visible { opacity: 1; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Cat Office - Agent Names</h1>
    <p class="subtitle">Name your agents. They'll appear in the order they connect.</p>
    <div class="info">
      The first agent to connect gets the first name, the second gets the second, and so on.<br>
      Leave a field blank to use the default cat name (Whiskers, Mittens, etc.).
    </div>
    <div id="agent-list" class="agent-list"></div>
    <div class="buttons">
      <button class="save-btn" onclick="save()">Save</button>
      <a href="/" class="back-link">Back to Cat Office</a>
      <span id="status" class="status">Saved!</span>
    </div>
  </div>

  <script>
    const MAX_AGENTS = 10;
    const DEFAULT_NAMES = [
      'Whiskers', 'Mittens', 'Shadow', 'Luna', 'Oliver',
      'Mochi', 'Pixel', 'Debug', 'Byte', 'Cookie'
    ];
    let names = [];

    function render() {
      const list = document.getElementById('agent-list');
      list.innerHTML = '';
      for (let i = 0; i < MAX_AGENTS; i++) {
        const name = names[i] || '';
        const placeholder = DEFAULT_NAMES[i] || 'Cat ' + (i + 1);
        list.innerHTML += '<div class="agent-row">' +
          '<span class="agent-number">Agent ' + (i + 1) + '</span>' +
          '<input class="name-input" data-index="' + i + '" ' +
            'value="' + name.replace(/"/g, '&quot;') + '" ' +
            'placeholder="' + placeholder + '" />' +
        '</div>';
      }
    }

    async function load() {
      const res = await fetch('/api/agent-names');
      names = await res.json();
      render();
    }

    async function save() {
      const inputs = document.querySelectorAll('.name-input');
      const newNames = [];
      inputs.forEach(input => {
        newNames[parseInt(input.dataset.index)] = input.value.trim();
      });
      await fetch('/api/agent-names', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNames),
      });
      names = newNames;
      const status = document.getElementById('status');
      status.classList.add('visible');
      setTimeout(() => status.classList.remove('visible'), 2000);
    }

    load();
  </script>
</body>
</html>`;
