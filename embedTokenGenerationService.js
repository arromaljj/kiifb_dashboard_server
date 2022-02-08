let auth = require(__dirname + "/authentication.js");
let Config = require(__dirname + "/../config/Config.json");
let DBConfig = require(__dirname + "/../config/DBConfig.json");
let utils = require(__dirname + "/utils.js");
const fetch = require("node-fetch");

async function executeQuery(user) {
  const sql = require("mssql");
  const QUERY = `SELECT * FROM ADUsers WHERE userName='${user}'`;
  // const config = {
  //     user: 'SA',
  //     password: 'Password123',
  //     server: 'localhost',
  //     database: 'msdb',
  // };
  const config = DBConfig;
  sql.on("error", (err) => {
    queryResults = { error: "error with connection" };
  });

  const queryResults = await sql
    .connect(config)
    .then((pool) => {
      return pool.request().query(QUERY);
    })
    .then((result) => {
      return { results: result.recordset };
    })
    .catch((err) => {

      return { error: "error with fetch" };
    });
  return Promise.resolve(queryResults);
}

export default async function getAllTokens(user) {
  const checkDatabase = await executeQuery(user);

  if (
    checkDatabase &&
    checkDatabase.results &&
    checkDatabase.results.length > 0
  ) {
    const group = "cs";
    const dashboards = Config["groups"][group]["dashboards"];
    const filterOption = checkDatabase["results"][0]["deptName"];
    const results = dashboards.map((dashboard) =>
      generateEmbedToken(
        Config["dashboards"][dashboard]["config"],
        Config["dashboards"][dashboard]["name"],
        Config["groups"][group]["filter"],
        filterOption
      )
    );
    return {
      status: 200,
      results: await Promise.all(results),
    };
  }
  if (!Config["users"][user]) {
    const group = "department";
    const dashboards = Config["groups"][group]["dashboards"];
    const results = dashboards.map((dashboard) =>
      generateEmbedToken(
        Config["dashboards"][dashboard]["config"],
        Config["dashboards"][dashboard]["name"],
        Config["groups"][group]["filter"],
        null
      )
    );
    return {
      status: 200,
      results: await Promise.all(results),
    };
  }
  const group = Config["users"][user]["group"];

  const dashboards = Config["groups"][group]["dashboards"];
  const results = dashboards.map((dashboard) =>
    generateEmbedToken(
      Config["dashboards"][dashboard]["config"],
      Config["dashboards"][dashboard]["name"],
      Config["groups"][group]["filter"],
      null
    )
  );
  // const configs = dashboards.map(dashboard => Config["dashboards"][dashboard]["config"])
  // const results = await configs.map(config =>  generateEmbedToken(config))

  return {
    status: 200,
    results: await Promise.all(results),
  };
}

async function generateEmbedToken(
  config_id,
  dashboardName,
  filter,
  filterOptions
) {
  let config = config_id;

  // Check for any non-existing credential or invalid credential from config.json file
  let configCheckResult = utils.validateConfig(config);
  if (configCheckResult) {
    return {
      status: 400,
      error: configCheckResult,
    };
  }

  let tokenResponse = null;
  let errorResponse = null;

  // Call the function to get the response from the authentication request
  try {
    tokenResponse = await auth.getAuthenticationToken(config);
  } catch (err) {
    if (
      err.hasOwnProperty("error_description") &&
      err.hasOwnProperty("error")
    ) {
      errorResponse = err.error_description;
    } else {
      // Invalid PowerBI Username provided
      errorResponse = err.toString();
    }
    return {
      status: 401,
      error: errorResponse,
    };
  }

  // Extract AccessToken from the response
  let token = tokenResponse.accessToken;

  // embedData will be used for resolution of the Promise
  let embedData = null;

  // Call the function to get the Report Embed details
  try {
    embedData = await getReportEmbedDetails(
      token,
      config.workspaceId,
      config.reportId
    );

    // Call the function to get the Embed Token
    let embedToken = await getReportEmbedToken(token, embedData);

    return {
      dashboard: dashboardName,
      filter: filter,
      accessToken: embedToken.token,
      embedUrl: embedData.embedUrl,
      reportId: config.reportId,
      expiry: embedToken.expiration,
      status: 200,
      filterOptions: filterOptions,
    };
  } catch (err) {
    console.log(err);
    return {
      status: err.status,
      error:
        "Error while retrieving report embed details\r\n" +
        err.statusText +
        "\r\nRequestId: \n" +
        err.headers.get("requestid"),
    };
  }
}

async function getReportEmbedDetails(token, workspaceId, reportId) {
  const reportUrl =
    "https://api.powerbi.com/v1.0/myorg/groups/" +
    workspaceId +
    "/reports/" +
    reportId;
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: utils.getAuthHeader(token),
  };

  // Used node-fetch to call the PowerBI REST API
  let result = await fetch(reportUrl, {
    method: "GET",
    headers: headers,
  });
  if (!result.ok) throw result;
  return result.json();
}

async function getReportEmbedToken(token, embedData) {
  const embedTokenUrl = "https://api.powerbi.com/v1.0/myorg/GenerateToken";
  const headers = {
    "Content-Type": "application/json",
    Authorization: utils.getAuthHeader(token),
  };

  const formData = {
    datasets: [
      {
        id: embedData.datasetId,
      },
    ],
    reports: [
      {
        id: embedData.id,
      },
    ],
  };

  // Used node-fetch to call the PowerBI REST API
  let result = await fetch(embedTokenUrl, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(formData),
  });
  if (!result.ok) throw result;
  return result.json();
}

module.exports = {
  getAllTokens: getAllTokens,
};
