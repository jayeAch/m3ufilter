module.exports = {
  apps: [{
    name: "m3u-filter",
    script: "dist/app-controller.js",
    out_file: "/dev/null",
    error_file: "/dev/null",
    instances: "1",
    exec_mode: "fork",
    watch: false,
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,
    node_args: [
      "--max-old-space-size=96",
      "--max-semi-space-size=2",
      "--jitless",
      "--gc-memory-reducer-start-delay-ms=8000",
      "--memory-reducer-gc-count=2",
      "--memory-reducer",
    ],
    env: {
      NODE_ENV: "production",
      UV_THREADPOOL_SIZE: "1"
    }
  }]
};
