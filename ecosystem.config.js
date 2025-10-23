module.exports = {
  apps: [{
    name: "m3u-filter",
    script: "dist/app-controller.js",
    instances: "max",
    exec_mode: "cluster",
    node_args: [
      "--max-old-space-size=768",
      "--optimize-for-size", 
      "--max-semi-space-size=64",
      "--turbo-filter=M3UFilterStream|handleGetm3u"
    ],
    env: {
      NODE_ENV: "production"
    }
  }]
};
