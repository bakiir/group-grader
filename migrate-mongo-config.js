// In this file you can configure migrate-mongo
require("dotenv").config();

const config = {
  mongodb: {
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/group-grader",

    options: {
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
    }
  },

  migrationsDir: "migrations",

  changelogCollectionName: "changelog",

  lockCollectionName: "changelog_lock",

  lockTtl: 0,

  migrationFileExtension: ".js",

  useFileHash: false,

  moduleSystem: 'commonjs',
};

module.exports = config;