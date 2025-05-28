// ecosystem.config.js
module.exports = {
    apps: [
      {
        name: 'heroku-app',
        script: './dist/index.js',
        instances: 1, // or "max" if you want to auto-scale (use cautiously)
        autorestart: true,
        watch: false,
        max_memory_restart: '200M' // optional: restart if memory exceeds limit
      }
    ]
  };
  