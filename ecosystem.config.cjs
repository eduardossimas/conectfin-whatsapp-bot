// PM2 Ecosystem Configuration
// Arquivo em CommonJS (.cjs) para compatibilidade com PM2
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
      
      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,
      max_memory_restart: '500M',
      
      // Variáveis de ambiente
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Restart automático em caso de crash
      exp_backoff_restart_delay: 100,
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Argumentos do Node.js
      node_args: '--max-old-space-size=512'
    }
  ],
  
  // Configuração de deploy para AWS
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['SEU_IP_AWS'],
      ref: 'origin/main',
      repo: 'git@github.com:eduardossimas/conectfin-whatsapp-bot.git',
      path: '/home/ubuntu/conectfin-bot',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.cjs --env production'
    }
  }
};
