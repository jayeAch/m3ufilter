module.exports = {
  presets: [
    ["@babel/preset-env", { 
      targets: { node: "current" }, 
      bugfixes: true 
    }],
    ["@babel/preset-typescript", { onlyRemoveTypeImports: true }],
  ],
};
