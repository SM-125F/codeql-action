"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const github = __importStar(require("@actions/github"));
const ava_1 = __importDefault(require("ava"));
const semver_1 = require("semver");
const sinon = __importStar(require("sinon"));
const api = __importStar(require("./api-client"));
const codeql_1 = require("./codeql");
const configUtils = __importStar(require("./config-utils"));
const languages_1 = require("./languages");
const logging_1 = require("./logging");
const testing_utils_1 = require("./testing-utils");
const util = __importStar(require("./util"));
testing_utils_1.setupTests(ava_1.default);
const sampleApiDetails = {
    auth: "token",
    externalRepoAuth: "token",
    url: "https://github.example.com",
};
const gitHubVersion = { type: util.GitHubVariant.DOTCOM };
// Returns the filepath of the newly-created file
function createConfigFile(inputFileContents, tmpDir) {
    const configFilePath = path.join(tmpDir, "input");
    fs.writeFileSync(configFilePath, inputFileContents, "utf8");
    return configFilePath;
}
function mockGetContents(content) {
    // Passing an auth token is required, so we just use a dummy value
    const client = github.getOctokit("123");
    const response = {
        data: content,
    };
    const spyGetContents = sinon
        .stub(client.repos, "getContent")
        .resolves(response);
    sinon.stub(api, "getApiClient").value(() => client);
    return spyGetContents;
}
function mockListLanguages(languages) {
    // Passing an auth token is required, so we just use a dummy value
    const client = github.getOctokit("123");
    const response = {
        data: {},
    };
    for (const language of languages) {
        response.data[language] = 123;
    }
    sinon.stub(client.repos, "listLanguages").resolves(response);
    sinon.stub(api, "getApiClient").value(() => client);
}
ava_1.default("load empty config", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const logger = logging_1.getRunnerLogger(true);
        const languages = "javascript,python";
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        javascript: { queries: ["query1.ql"] },
                        python: { queries: ["query2.ql"] },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        const config = await configUtils.initConfig(languages, undefined, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logger);
        t.deepEqual(config, await configUtils.getDefaultConfig(languages, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logger));
    });
});
ava_1.default("loading config saves config", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const logger = logging_1.getRunnerLogger(true);
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        javascript: { queries: ["query1.ql"] },
                        python: { queries: ["query2.ql"] },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        // Sanity check the saved config file does not already exist
        t.false(fs.existsSync(configUtils.getPathToParsedConfigFile(tmpDir)));
        // Sanity check that getConfig returns undefined before we have called initConfig
        t.deepEqual(await configUtils.getConfig(tmpDir, logger), undefined);
        const config1 = await configUtils.initConfig("javascript,python", undefined, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logger);
        // The saved config file should now exist
        t.true(fs.existsSync(configUtils.getPathToParsedConfigFile(tmpDir)));
        // And that same newly-initialised config should now be returned by getConfig
        const config2 = await configUtils.getConfig(tmpDir, logger);
        t.deepEqual(config1, config2);
    });
});
ava_1.default("load input outside of workspace", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        try {
            await configUtils.initConfig(undefined, undefined, undefined, "../input", undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getConfigFileOutsideWorkspaceErrorMessage(path.join(tmpDir, "../input"))));
        }
    });
});
ava_1.default("load non-local input with invalid repo syntax", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        // no filename given, just a repo
        const configFile = "octo-org/codeql-config@main";
        try {
            await configUtils.initConfig(undefined, undefined, undefined, configFile, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getConfigFileRepoFormatInvalidMessage("octo-org/codeql-config@main")));
        }
    });
});
ava_1.default("load non-existent input", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const languages = "javascript";
        const configFile = "input";
        t.false(fs.existsSync(path.join(tmpDir, configFile)));
        try {
            await configUtils.initConfig(languages, undefined, undefined, configFile, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getConfigFileDoesNotExistErrorMessage(path.join(tmpDir, "input"))));
        }
    });
});
ava_1.default("load non-empty input", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        javascript: {
                            "/foo/a.ql": {},
                            "/bar/b.ql": {},
                        },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        // Just create a generic config object with non-default values for all fields
        const inputFileContents = `
      name: my config
      disable-default-queries: true
      queries:
        - uses: ./foo
      paths-ignore:
        - a
        - b
      paths:
        - c/d`;
        fs.mkdirSync(path.join(tmpDir, "foo"));
        // And the config we expect it to parse to
        const expectedConfig = {
            languages: [languages_1.Language.javascript],
            queries: {
                javascript: {
                    builtin: [],
                    custom: [
                        {
                            queries: ["/foo/a.ql", "/bar/b.ql"],
                            searchPath: tmpDir,
                        },
                    ],
                },
            },
            pathsIgnore: ["a", "b"],
            paths: ["c/d"],
            originalUserInput: {
                name: "my config",
                "disable-default-queries": true,
                queries: [{ uses: "./foo" }],
                "paths-ignore": ["a", "b"],
                paths: ["c/d"],
            },
            tempDir: tmpDir,
            toolCacheDir: tmpDir,
            codeQLCmd: codeQL.getPath(),
            gitHubVersion,
            dbLocation: path.resolve(tmpDir, "codeql_databases"),
            packs: {},
        };
        const languages = "javascript";
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        const actualConfig = await configUtils.initConfig(languages, undefined, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Should exactly equal the object we constructed earlier
        t.deepEqual(actualConfig, expectedConfig);
    });
});
ava_1.default("Default queries are used", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        // Check that the default behaviour is to add the default queries.
        // In this case if a config file is specified but does not include
        // the disable-default-queries field.
        // We determine this by whether CodeQL.resolveQueries is called
        // with the correct arguments.
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return {
                    byLanguage: {
                        javascript: {
                            "foo.ql": {},
                        },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        // The important point of this config is that it doesn't specify
        // the disable-default-queries field.
        // Any other details are hopefully irrelevant for this test.
        const inputFileContents = `
      paths:
        - foo`;
        fs.mkdirSync(path.join(tmpDir, "foo"));
        const languages = "javascript";
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        await configUtils.initConfig(languages, undefined, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolve queries was called correctly
        t.deepEqual(resolveQueriesArgs.length, 1);
        t.deepEqual(resolveQueriesArgs[0].queries, [
            "javascript-code-scanning.qls",
        ]);
        t.deepEqual(resolveQueriesArgs[0].extraSearchPath, undefined);
    });
});
/**
 * Returns the provided queries, just in the right format for a resolved query
 * This way we can test by seeing which returned items are in the final
 * configuration.
 */
function queriesToResolvedQueryForm(queries) {
    const dummyResolvedQueries = {};
    for (const q of queries) {
        dummyResolvedQueries[q] = {};
    }
    return {
        byLanguage: {
            javascript: dummyResolvedQueries,
        },
        noDeclaredLanguage: {},
        multipleDeclaredLanguages: {},
    };
}
ava_1.default("Queries can be specified in config file", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const inputFileContents = `
      name: my config
      queries:
        - uses: ./foo`;
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        fs.mkdirSync(path.join(tmpDir, "foo"));
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return queriesToResolvedQueryForm(queries);
            },
        });
        const languages = "javascript";
        const config = await configUtils.initConfig(languages, undefined, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolveQueries was called correctly
        // It'll be called once for the default queries
        // and once for `./foo` from the config file.
        t.deepEqual(resolveQueriesArgs.length, 2);
        t.deepEqual(resolveQueriesArgs[1].queries.length, 1);
        t.regex(resolveQueriesArgs[1].queries[0], /.*\/foo$/);
        // Now check that the end result contains the default queries and the query from config
        t.deepEqual(config.queries["javascript"].builtin.length, 1);
        t.deepEqual(config.queries["javascript"].custom.length, 1);
        t.regex(config.queries["javascript"].builtin[0], /javascript-code-scanning.qls$/);
        t.regex(config.queries["javascript"].custom[0].queries[0], /.*\/foo$/);
    });
});
ava_1.default("Queries from config file can be overridden in workflow file", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const inputFileContents = `
      name: my config
      queries:
        - uses: ./foo`;
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        // This config item should take precedence over the config file but shouldn't affect the default queries.
        const testQueries = "./override";
        fs.mkdirSync(path.join(tmpDir, "foo"));
        fs.mkdirSync(path.join(tmpDir, "override"));
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return queriesToResolvedQueryForm(queries);
            },
        });
        const languages = "javascript";
        const config = await configUtils.initConfig(languages, testQueries, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolveQueries was called correctly
        // It'll be called once for the default queries and once for `./override`,
        // but won't be called for './foo' from the config file.
        t.deepEqual(resolveQueriesArgs.length, 2);
        t.deepEqual(resolveQueriesArgs[1].queries.length, 1);
        t.regex(resolveQueriesArgs[1].queries[0], /.*\/override$/);
        // Now check that the end result contains only the default queries and the override query
        t.deepEqual(config.queries["javascript"].builtin.length, 1);
        t.deepEqual(config.queries["javascript"].custom.length, 1);
        t.regex(config.queries["javascript"].builtin[0], /javascript-code-scanning.qls$/);
        t.regex(config.queries["javascript"].custom[0].queries[0], /.*\/override$/);
    });
});
ava_1.default("Queries in workflow file can be used in tandem with the 'disable default queries' option", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        process.env["RUNNER_TEMP"] = tmpDir;
        process.env["GITHUB_WORKSPACE"] = tmpDir;
        const inputFileContents = `
      name: my config
      disable-default-queries: true`;
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        const testQueries = "./workflow-query";
        fs.mkdirSync(path.join(tmpDir, "workflow-query"));
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return queriesToResolvedQueryForm(queries);
            },
        });
        const languages = "javascript";
        const config = await configUtils.initConfig(languages, testQueries, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolveQueries was called correctly
        // It'll be called once for `./workflow-query`,
        // but won't be called for the default one since that was disabled
        t.deepEqual(resolveQueriesArgs.length, 1);
        t.deepEqual(resolveQueriesArgs[0].queries.length, 1);
        t.regex(resolveQueriesArgs[0].queries[0], /.*\/workflow-query$/);
        // Now check that the end result contains only the workflow query, and not the default one
        t.deepEqual(config.queries["javascript"].builtin.length, 0);
        t.deepEqual(config.queries["javascript"].custom.length, 1);
        t.regex(config.queries["javascript"].custom[0].queries[0], /.*\/workflow-query$/);
    });
});
ava_1.default("Multiple queries can be specified in workflow file, no config file required", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        fs.mkdirSync(path.join(tmpDir, "override1"));
        fs.mkdirSync(path.join(tmpDir, "override2"));
        const testQueries = "./override1,./override2";
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return queriesToResolvedQueryForm(queries);
            },
        });
        const languages = "javascript";
        const config = await configUtils.initConfig(languages, testQueries, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolveQueries was called correctly:
        // It'll be called once for the default queries,
        // and then once for each of the two queries from the workflow
        t.deepEqual(resolveQueriesArgs.length, 3);
        t.deepEqual(resolveQueriesArgs[1].queries.length, 1);
        t.deepEqual(resolveQueriesArgs[2].queries.length, 1);
        t.regex(resolveQueriesArgs[1].queries[0], /.*\/override1$/);
        t.regex(resolveQueriesArgs[2].queries[0], /.*\/override2$/);
        // Now check that the end result contains both the queries from the workflow, as well as the defaults
        t.deepEqual(config.queries["javascript"].builtin.length, 1);
        t.deepEqual(config.queries["javascript"].custom.length, 2);
        t.regex(config.queries["javascript"].builtin[0], /javascript-code-scanning.qls$/);
        t.regex(config.queries["javascript"].custom[0].queries[0], /.*\/override1$/);
        t.regex(config.queries["javascript"].custom[1].queries[0], /.*\/override2$/);
    });
});
ava_1.default("Queries in workflow file can be added to the set of queries without overriding config file", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        process.env["RUNNER_TEMP"] = tmpDir;
        process.env["GITHUB_WORKSPACE"] = tmpDir;
        const inputFileContents = `
      name: my config
      queries:
        - uses: ./foo`;
        const configFilePath = createConfigFile(inputFileContents, tmpDir);
        // These queries shouldn't override anything, because the value is prefixed with "+"
        const testQueries = "+./additional1,./additional2";
        fs.mkdirSync(path.join(tmpDir, "foo"));
        fs.mkdirSync(path.join(tmpDir, "additional1"));
        fs.mkdirSync(path.join(tmpDir, "additional2"));
        const resolveQueriesArgs = [];
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries(queries, extraSearchPath) {
                resolveQueriesArgs.push({ queries, extraSearchPath });
                return queriesToResolvedQueryForm(queries);
            },
        });
        const languages = "javascript";
        const config = await configUtils.initConfig(languages, testQueries, undefined, configFilePath, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        // Check resolveQueries was called correctly
        // It'll be called once for the default queries,
        // once for each of additional1 and additional2,
        // and once for './foo' from the config file
        t.deepEqual(resolveQueriesArgs.length, 4);
        t.deepEqual(resolveQueriesArgs[1].queries.length, 1);
        t.regex(resolveQueriesArgs[1].queries[0], /.*\/additional1$/);
        t.deepEqual(resolveQueriesArgs[2].queries.length, 1);
        t.regex(resolveQueriesArgs[2].queries[0], /.*\/additional2$/);
        t.deepEqual(resolveQueriesArgs[3].queries.length, 1);
        t.regex(resolveQueriesArgs[3].queries[0], /.*\/foo$/);
        // Now check that the end result contains all the queries
        t.deepEqual(config.queries["javascript"].builtin.length, 1);
        t.deepEqual(config.queries["javascript"].custom.length, 3);
        t.regex(config.queries["javascript"].builtin[0], /javascript-code-scanning.qls$/);
        t.regex(config.queries["javascript"].custom[0].queries[0], /.*\/additional1$/);
        t.regex(config.queries["javascript"].custom[1].queries[0], /.*\/additional2$/);
        t.regex(config.queries["javascript"].custom[2].queries[0], /.*\/foo$/);
    });
});
ava_1.default("Invalid queries in workflow file handled correctly", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const queries = "foo/bar@v1@v3";
        const languages = "javascript";
        // This function just needs to be type-correct; it doesn't need to do anything,
        // since we're deliberately passing in invalid data
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        javascript: {},
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        try {
            await configUtils.initConfig(languages, queries, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            t.fail("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getQueryUsesInvalid(undefined, "foo/bar@v1@v3")));
        }
    });
});
ava_1.default("API client used when reading remote config", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        javascript: {
                            "foo.ql": {},
                        },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        const inputFileContents = `
      name: my config
      disable-default-queries: true
      queries:
        - uses: ./
        - uses: ./foo
        - uses: foo/bar@dev
      paths-ignore:
        - a
        - b
      paths:
        - c/d`;
        const dummyResponse = {
            content: Buffer.from(inputFileContents).toString("base64"),
        };
        const spyGetContents = mockGetContents(dummyResponse);
        // Create checkout directory for remote queries repository
        fs.mkdirSync(path.join(tmpDir, "foo/bar/dev"), { recursive: true });
        const configFile = "octo-org/codeql-config/config.yaml@main";
        const languages = "javascript";
        await configUtils.initConfig(languages, undefined, undefined, configFile, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        t.assert(spyGetContents.called);
    });
});
ava_1.default("Remote config handles the case where a directory is provided", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const dummyResponse = []; // directories are returned as arrays
        mockGetContents(dummyResponse);
        const repoReference = "octo-org/codeql-config/config.yaml@main";
        try {
            await configUtils.initConfig(undefined, undefined, undefined, repoReference, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getConfigFileDirectoryGivenMessage(repoReference)));
        }
    });
});
ava_1.default("Invalid format of remote config handled correctly", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const dummyResponse = {
        // note no "content" property here
        };
        mockGetContents(dummyResponse);
        const repoReference = "octo-org/codeql-config/config.yaml@main";
        try {
            await configUtils.initConfig(undefined, undefined, undefined, repoReference, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getConfigFileFormatInvalidMessage(repoReference)));
        }
    });
});
ava_1.default("No detected languages", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        mockListLanguages([]);
        const codeQL = codeql_1.setCodeQL({
            async resolveLanguages() {
                return {};
            },
        });
        try {
            await configUtils.initConfig(undefined, undefined, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getNoLanguagesError()));
        }
    });
});
ava_1.default("Unknown languages", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const languages = "rubbish,english";
        try {
            await configUtils.initConfig(languages, undefined, undefined, undefined, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeql_1.getCachedCodeQL(), tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
            throw new Error("initConfig did not throw error");
        }
        catch (err) {
            t.deepEqual(err, new Error(configUtils.getUnknownLanguagesError(["rubbish", "english"])));
        }
    });
});
ava_1.default("Config specifies packages", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {},
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        const inputFileContents = `
      name: my config
      disable-default-queries: true
      packs:
        - a/b@1.2.3
      `;
        const configFile = path.join(tmpDir, "codeql-config.yaml");
        fs.writeFileSync(configFile, inputFileContents);
        const languages = "javascript";
        const { packs } = await configUtils.initConfig(languages, undefined, undefined, configFile, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        t.deepEqual(packs, {
            [languages_1.Language.javascript]: [
                {
                    packName: "a/b",
                    version: semver_1.clean("1.2.3"),
                },
            ],
        });
    });
});
ava_1.default("Config specifies packages for multiple languages", async (t) => {
    return await util.withTmpDir(async (tmpDir) => {
        const codeQL = codeql_1.setCodeQL({
            async resolveQueries() {
                return {
                    byLanguage: {
                        cpp: { "/foo/a.ql": {} },
                    },
                    noDeclaredLanguage: {},
                    multipleDeclaredLanguages: {},
                };
            },
        });
        const inputFileContents = `
      name: my config
      disable-default-queries: true
      queries:
      - uses: ./foo
      packs:
        javascript:
          - a/b@1.2.3
        python:
          - c/d@1.2.3
      `;
        const configFile = path.join(tmpDir, "codeql-config.yaml");
        fs.writeFileSync(configFile, inputFileContents);
        fs.mkdirSync(path.join(tmpDir, "foo"));
        const languages = "javascript,python,cpp";
        const { packs, queries } = await configUtils.initConfig(languages, undefined, undefined, configFile, undefined, { owner: "github", repo: "example" }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
        t.deepEqual(packs, {
            [languages_1.Language.javascript]: [
                {
                    packName: "a/b",
                    version: semver_1.clean("1.2.3"),
                },
            ],
            [languages_1.Language.python]: [
                {
                    packName: "c/d",
                    version: semver_1.clean("1.2.3"),
                },
            ],
        });
        t.deepEqual(queries, {
            cpp: {
                builtin: [],
                custom: [
                    {
                        queries: ["/foo/a.ql"],
                        searchPath: tmpDir,
                    },
                ],
            },
            javascript: {
                builtin: [],
                custom: [],
            },
            python: {
                builtin: [],
                custom: [],
            },
        });
    });
});
function doInvalidInputTest(testName, inputFileContents, expectedErrorMessageGenerator) {
    ava_1.default(`load invalid input - ${testName}`, async (t) => {
        return await util.withTmpDir(async (tmpDir) => {
            const codeQL = codeql_1.setCodeQL({
                async resolveQueries() {
                    return {
                        byLanguage: {},
                        noDeclaredLanguage: {},
                        multipleDeclaredLanguages: {},
                    };
                },
            });
            const languages = "javascript";
            const configFile = "input";
            const inputFile = path.join(tmpDir, configFile);
            fs.writeFileSync(inputFile, inputFileContents, "utf8");
            try {
                await configUtils.initConfig(languages, undefined, undefined, configFile, undefined, { owner: "github", repo: "example " }, tmpDir, tmpDir, codeQL, tmpDir, gitHubVersion, sampleApiDetails, logging_1.getRunnerLogger(true));
                throw new Error("initConfig did not throw error");
            }
            catch (err) {
                t.deepEqual(err, new Error(expectedErrorMessageGenerator(inputFile)));
            }
        });
    });
}
doInvalidInputTest("name invalid type", `
  name:
    - foo: bar`, configUtils.getNameInvalid);
doInvalidInputTest("disable-default-queries invalid type", `disable-default-queries: 42`, configUtils.getDisableDefaultQueriesInvalid);
doInvalidInputTest("queries invalid type", `queries: foo`, configUtils.getQueriesInvalid);
doInvalidInputTest("paths-ignore invalid type", `paths-ignore: bar`, configUtils.getPathsIgnoreInvalid);
doInvalidInputTest("paths invalid type", `paths: 17`, configUtils.getPathsInvalid);
doInvalidInputTest("queries uses invalid type", `
  queries:
  - uses:
      - hello: world`, configUtils.getQueryUsesInvalid);
function doInvalidQueryUsesTest(input, expectedErrorMessageGenerator) {
    // Invalid contents of a "queries.uses" field.
    // Should fail with the expected error message
    const inputFileContents = `
    name: my config
    queries:
      - name: foo
        uses: ${input}`;
    doInvalidInputTest(`queries uses "${input}"`, inputFileContents, expectedErrorMessageGenerator);
}
// Various "uses" fields, and the errors they should produce
doInvalidQueryUsesTest("''", (c) => configUtils.getQueryUsesInvalid(c, undefined));
doInvalidQueryUsesTest("foo/bar", (c) => configUtils.getQueryUsesInvalid(c, "foo/bar"));
doInvalidQueryUsesTest("foo/bar@v1@v2", (c) => configUtils.getQueryUsesInvalid(c, "foo/bar@v1@v2"));
doInvalidQueryUsesTest("foo@master", (c) => configUtils.getQueryUsesInvalid(c, "foo@master"));
doInvalidQueryUsesTest("https://github.com/foo/bar@master", (c) => configUtils.getQueryUsesInvalid(c, "https://github.com/foo/bar@master"));
doInvalidQueryUsesTest("./foo", (c) => configUtils.getLocalPathDoesNotExist(c, "foo"));
doInvalidQueryUsesTest("./..", (c) => configUtils.getLocalPathOutsideOfRepository(c, ".."));
const validPaths = [
    "foo",
    "foo/",
    "foo/**",
    "foo/**/",
    "foo/**/**",
    "foo/**/bar/**/baz",
    "**/",
    "**/foo",
    "/foo",
];
const invalidPaths = ["a/***/b", "a/**b", "a/b**", "**"];
ava_1.default("path validations", (t) => {
    // Dummy values to pass to validateAndSanitisePath
    const propertyName = "paths";
    const configFile = "./.github/codeql/config.yml";
    for (const validPath of validPaths) {
        t.truthy(configUtils.validateAndSanitisePath(validPath, propertyName, configFile, logging_1.getRunnerLogger(true)));
    }
    for (const invalidPath of invalidPaths) {
        t.throws(() => configUtils.validateAndSanitisePath(invalidPath, propertyName, configFile, logging_1.getRunnerLogger(true)));
    }
});
ava_1.default("path sanitisation", (t) => {
    // Dummy values to pass to validateAndSanitisePath
    const propertyName = "paths";
    const configFile = "./.github/codeql/config.yml";
    // Valid paths are not modified
    t.deepEqual(configUtils.validateAndSanitisePath("foo/bar", propertyName, configFile, logging_1.getRunnerLogger(true)), "foo/bar");
    // Trailing stars are stripped
    t.deepEqual(configUtils.validateAndSanitisePath("foo/**", propertyName, configFile, logging_1.getRunnerLogger(true)), "foo/");
});
/**
 * Test macro for ensuring the packs block is valid
 */
function parsePacksMacro(t, packsByLanguage, languages, expected) {
    t.deepEqual(configUtils.parsePacksFromConfig(packsByLanguage, languages, "/a/b"), expected);
}
parsePacksMacro.title = (providedTitle) => `Parse Packs: ${providedTitle}`;
/**
 * Test macro for testing when the packs block is invalid
 */
function parsePacksErrorMacro(t, packsByLanguage, languages, expected) {
    t.throws(() => {
        configUtils.parsePacksFromConfig(packsByLanguage, languages, "/a/b");
    }, {
        message: expected,
    });
}
parsePacksErrorMacro.title = (providedTitle) => `Parse Packs Error: ${providedTitle}`;
/**
 * Test macro for testing when the packs block is invalid
 */
function invalidPackNameMacro(t, name) {
    parsePacksErrorMacro(t, { [languages_1.Language.cpp]: [name] }, [languages_1.Language.cpp], new RegExp(`The configuration file "/a/b" is invalid: property "packs" "${name}" is not a valid pack`));
}
invalidPackNameMacro.title = (_, arg) => `Invalid pack string: ${arg}`;
ava_1.default("no packs", parsePacksMacro, {}, [], {});
ava_1.default("two packs", parsePacksMacro, ["a/b", "c/d@1.2.3"], [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: semver_1.clean("1.2.3") },
    ],
});
ava_1.default("two packs with spaces", parsePacksMacro, [" a/b ", " c/d@1.2.3 "], [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: semver_1.clean("1.2.3") },
    ],
});
ava_1.default("two packs with language", parsePacksMacro, {
    [languages_1.Language.cpp]: ["a/b", "c/d@1.2.3"],
    [languages_1.Language.java]: ["d/e", "f/g@1.2.3"],
}, [languages_1.Language.cpp, languages_1.Language.java, languages_1.Language.csharp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: semver_1.clean("1.2.3") },
    ],
    [languages_1.Language.java]: [
        { packName: "d/e", version: undefined },
        { packName: "f/g", version: semver_1.clean("1.2.3") },
    ],
});
ava_1.default("no language", parsePacksErrorMacro, ["a/b@1.2.3"], [languages_1.Language.java, languages_1.Language.python], /The configuration file "\/a\/b" is invalid: property "packs" must split packages by language/);
ava_1.default("invalid language", parsePacksErrorMacro, { [languages_1.Language.java]: ["c/d"] }, [languages_1.Language.cpp], /The configuration file "\/a\/b" is invalid: property "packs" has "java", but it is not one of the languages to analyze/);
ava_1.default("not an array", parsePacksErrorMacro, { [languages_1.Language.cpp]: "c/d" }, [languages_1.Language.cpp], /The configuration file "\/a\/b" is invalid: property "packs" must be an array of non-empty strings/);
ava_1.default(invalidPackNameMacro, "c"); // all packs require at least a scope and a name
ava_1.default(invalidPackNameMacro, "c-/d");
ava_1.default(invalidPackNameMacro, "-c/d");
ava_1.default(invalidPackNameMacro, "c/d_d");
ava_1.default(invalidPackNameMacro, "c/d@x");
/**
 * Test macro for testing the packs block and the packs input
 */
function parseInputAndConfigMacro(t, packsFromConfig, packsFromInput, languages, expected) {
    t.deepEqual(configUtils.parsePacks(packsFromConfig, packsFromInput, languages, "/a/b"), expected);
}
parseInputAndConfigMacro.title = (providedTitle) => `Parse Packs input and config: ${providedTitle}`;
function parseInputAndConfigErrorMacro(t, packsFromConfig, packsFromInput, languages, expected) {
    t.throws(() => {
        configUtils.parsePacks(packsFromConfig, packsFromInput, languages, "/a/b");
    }, {
        message: expected,
    });
}
parseInputAndConfigErrorMacro.title = (providedTitle) => `Parse Packs input and config Error: ${providedTitle}`;
ava_1.default("input only", parseInputAndConfigMacro, {}, " c/d ", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [{ packName: "c/d", version: undefined }],
});
ava_1.default("input only with multiple", parseInputAndConfigMacro, {}, "a/b , c/d@1.2.3", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: "1.2.3" },
    ],
});
ava_1.default("input only with +", parseInputAndConfigMacro, {}, "  +  a/b , c/d@1.2.3 ", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: "1.2.3" },
    ],
});
ava_1.default("config only", parseInputAndConfigMacro, ["a/b", "c/d"], "  ", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: undefined },
    ],
});
ava_1.default("input overrides", parseInputAndConfigMacro, ["a/b", "c/d"], " e/f, g/h@1.2.3 ", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "e/f", version: undefined },
        { packName: "g/h", version: "1.2.3" },
    ],
});
ava_1.default("input and config", parseInputAndConfigMacro, ["a/b", "c/d"], " +e/f, g/h@1.2.3 ", [languages_1.Language.cpp], {
    [languages_1.Language.cpp]: [
        { packName: "e/f", version: undefined },
        { packName: "g/h", version: "1.2.3" },
        { packName: "a/b", version: undefined },
        { packName: "c/d", version: undefined },
    ],
});
ava_1.default("input with no language", parseInputAndConfigErrorMacro, {}, "c/d", [], /No languages specified/);
ava_1.default("input with two languages", parseInputAndConfigErrorMacro, {}, "c/d", [languages_1.Language.cpp, languages_1.Language.csharp], /multi-language analysis/);
ava_1.default("input with + only", parseInputAndConfigErrorMacro, {}, " + ", [languages_1.Language.cpp], /remove the '\+'/);
ava_1.default("input with invalid pack name", parseInputAndConfigErrorMacro, {}, " xxx", [languages_1.Language.cpp], /"xxx" is not a valid pack/);
// errors
// input w invalid pack name
//# sourceMappingURL=config-utils.test.js.map