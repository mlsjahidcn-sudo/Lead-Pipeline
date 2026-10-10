// PM2 process file for the Lead-Pipeline CRM on Hostinger VPS.
// One long-running process that serves the SPA (dist/) and the Express/Bun API.
// Start with:  pm2 start ecosystem.config.cjs --only crm
// Then:        pm2 startup && pm2 save      (so it survives a reboot)

module.exports = {
  apps: [
    {
      name: 'crm',
      // `start` runs `vite build` then exec's the API. The bun process
      // loads the freshly-built dist/ via express.static at startup.
      script: 'bun',
      args: 'run start',
      cwd: '/var/www/lead-pipeline',
      // env from .env at cwd is loaded by `import 'dotenv/config'` in
      // server/index.ts — we pass through NODE_ENV + PORT here.
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      // Logs land in /var/log/lead-pipeline and survive between deploys.
      out_file: '/var/log/lead-pipeline/crm.out.log',
      error_file: '/var/log/lead-pipeline/crm.err.log',
      merge_logs: true,
      time: true,
      // Auto-restart, but with a backoff so a misconfigured .env doesn't
      // peg the CPU. Max 10 restarts in a minute before PM2 marks it errored.
      max_restarts: 10,
      restart_delay: 2000,
      // Listen on all interfaces so a reverse proxy (Caddy) can reach it.
      // Bun respects this; Express just listens on PORT from env.
      instances: 1,
      exec_mode: 'fork',
    },
  ],
};
