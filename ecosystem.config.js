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
      "--max-old-space-size=128",
      "--max-semi-space-size=8",
      "--optimize-for-size",
    ],
    env: {
      NODE_ENV: "production"
    }
  }]
};
