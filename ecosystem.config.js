const path = require('path');
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: 'opentodo-server',
      script: path.join(ROOT, 'server/src/index.js'),
      cwd: ROOT,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: path.join(ROOT, 'logs/server-error.log'),
      out_file:   path.join(ROOT, 'logs/server-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'opentodo-scheduler',
      script: path.join(ROOT, 'server/scheduler.js'),
      cwd: ROOT,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: path.join(ROOT, 'logs/scheduler-error.log'),
      out_file:   path.join(ROOT, 'logs/scheduler-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
