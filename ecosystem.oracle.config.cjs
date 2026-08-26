// PM2 Ecosystem Configuration - ConectFin Bot (Oracle Cloud)
module.exports = {
  apps: [
    {
      // Configuração Principal
      name: 'conectfin-bot',
      script: './index-unified.js',

      // Instâncias e modo
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 100,

      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/home/ubuntu/conectfin-whatsapp-bot/logs/error.log',
      out_file: '/home/ubuntu/conectfin-whatsapp-bot/logs/out.log',
      log_file: '/home/ubuntu/conectfin-whatsapp-bot/logs/combined.log',
      merge_logs: true,
      max_memory_restart: '500M',

      // Variáveis de ambiente
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },

      // Graceful shutdown
      kill_timeout: 5000,
      node_args: '--max-old-space-size=512'
    }
  ]
};
