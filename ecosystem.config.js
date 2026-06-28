module.exports = {
  apps: [{
    name: "m3u-filter",
    script: "dist/app-controller.js",
    instances: "1",
    exec_mode: "fork",
    node_args: [
      "--max-old-space-size=768",
      "--max-semi-space-size=64",
    ],
    env: {
      NODE_ENV: "production"
    }
  }]
};
