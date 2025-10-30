// PM2 Ecosystem Configuration (CommonJS format)
module.exports = {
  apps: [
    {
      // Configuração Principal
      name: 'conectfin-bot',
      script: './index-unified.js',
      
      // Instâncias e modo
      instances: 1,
      exec_mode: 'fork', // 'cluster' para múltiplas instâncias
      
      // Auto-restart
      autorestart: true,
      watch: false, // Não recarregar ao editar arquivos (use true em dev se quiser)
      max_restarts: 10, // Máximo de restarts em 1 minuto
      min_uptime: '10s', // Tempo mínimo para considerar que iniciou
      
      // Logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      merge_logs: true,
      max_memory_restart: '500M', // Reinicia se passar de 500MB
      
      // Variáveis de ambiente (fallback - use .env)
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // Restart automático em caso de crash
      exp_backoff_restart_delay: 100, // Delay inicial: 100ms
      
      // Tempo máximo para graceful shutdown
      kill_timeout: 5000, // 5 segundos
      wait_ready: true,
      listen_timeout: 10000, // 10 segundos esperando servidor ficar pronto
      
      // Modo cron para restart (opcional)
      // cron_restart: '0 3 * * *', // Reinicia todo dia às 3h (descomente se quiser)
      
      // Notificações de crash (integração futura)
      // pmx: true,
      
      // Argumentos do Node.js
      node_args: '--max-old-space-size=512', // Limita memória do Node
      
      // Tratamento de sinais
      shutdown_with_message: true
    }
  ],
  
  // Configuração de deploy (para AWS)
  deploy: {
    production: {
      user: 'ubuntu', // Usuário SSH (padrão EC2)
      host: ['SEU_IP_AWS'], // IP da EC2
      ref: 'origin/main',
      repo: 'git@github.com:eduardossimas/conectfin-whatsapp-bot.git',
      path: '/home/ubuntu/conectfin-bot',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'sudo apt-get update && sudo apt-get install -y git'
    }
  }
};
