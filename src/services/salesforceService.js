const axios = require('axios');

const SF_CONFIG = {
  prod: {
    authUrl: 'https://login.salesforce.com',
    clientId: process.env.SF_PROD_CLIENT_ID,
    clientSecret: process.env.SF_PROD_CLIENT_SECRET,
  },
  partial: {
    authUrl: 'https://login.salesforce.com',
    clientId: process.env.SF_PARTIAL_CLIENT_ID,
    clientSecret: process.env.SF_PARTIAL_CLIENT_SECRET,
  },
  sandbox: {
    authUrl: 'https://business-energy-3294--qa.sandbox.my.salesforce.com',
    clientId: process.env.SF_SANDBOX_CLIENT_ID,
    clientSecret: process.env.SF_SANDBOX_CLIENT_SECRET,
  },
  sandboxQA2: {
    authUrl: 'https://business-energy-3294--qa2.sandbox.my.salesforce.com',
    clientId: process.env.SF_SANDBOXQA2_CLIENT_ID,
    clientSecret: process.env.SF_SANDBOXQA2_CLIENT_SECRET,
  },
  sandboxPartial: {
    authUrl: 'https://business-energy-3294--partial.sandbox.my.salesforce.com',
    clientId: process.env.SF_SANDBOX_PARTIAL_CLIENT_ID,
    clientSecret: process.env.SF_SANDBOX_PARTIAL_CLIENT_SECRET,
  },
};

const tokenCache = {};

function normalizeBinary(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

async function getAccessToken(instanceType = 'sandbox') {
  const config = SF_CONFIG[instanceType];
  if (!config) throw new Error('Invalid Salesforce instance type');

  const now = Date.now();
  if (
    tokenCache[instanceType] &&
    tokenCache[instanceType].expiresAt - 60000 > now
  ) {
    return tokenCache[instanceType];
  }

  const response = await axios.post(
    `${config.authUrl}/services/oauth2/token`,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })
  );

  const { access_token, instance_url, expires_in } = response.data;
  tokenCache[instanceType] = {
    accessToken: access_token,
    instanceUrl: instance_url,
    expiresAt: now + expires_in * 1000,
  };

  return tokenCache[instanceType];
}

async function downloadContentVersion(contentVersionId, instanceType) {
  const { accessToken, instanceUrl } = await getAccessToken(instanceType);
  const response = await axios.get(
    `${instanceUrl}/services/data/v60.0/sobjects/ContentVersion/${contentVersionId}/VersionData`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    }
  );

  return normalizeBinary(response.data) || Buffer.alloc(0);
}

async function querySalesforce(soql, instanceType) {
  const { accessToken, instanceUrl } = await getAccessToken(instanceType);
  const response = await axios.get(
    `${instanceUrl}/services/data/v60.0/query`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: { q: soql },
    }
  );
  return response.data;
}

async function getSalesforceServerDate(instanceType) {
  const { accessToken, instanceUrl } = await getAccessToken(instanceType);
  const response = await axios.get(
    `${instanceUrl}/services/data/v60.0/limits`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const headerDate = response?.headers?.date;
  return headerDate ? new Date(headerDate) : new Date();
}

async function getSObjectRecord(objectApiName, recordId, instanceType) {
  const { accessToken, instanceUrl } = await getAccessToken(instanceType);
  const response = await axios.get(
    `${instanceUrl}/services/data/v60.0/sobjects/${objectApiName}/${recordId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return response.data;
}

async function downloadStaticResourceByName(resourceName, instanceType) {
  const { accessToken, instanceUrl } = await getAccessToken(instanceType);
  const soql = `SELECT Id FROM StaticResource WHERE Name = '${String(resourceName).replace(/'/g, "\\'")}' LIMIT 1`;
  const queryResponse = await axios.get(
    `${instanceUrl}/services/data/v60.0/query`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      params: { q: soql },
    }
  );

  const record = Array.isArray(queryResponse?.data?.records)
    ? queryResponse.data.records[0]
    : null;
  if (!record?.Id) {
    throw new Error(`Static Resource "${resourceName}" not found`);
  }

  const bodyResponse = await axios.get(
    `${instanceUrl}/services/data/v60.0/sobjects/StaticResource/${record.Id}/Body`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
    }
  );

  return normalizeBinary(bodyResponse.data) || Buffer.alloc(0);
}

module.exports = {
  downloadContentVersion,
  downloadStaticResourceByName,
  normalizeBinary,
  querySalesforce,
  getSObjectRecord,
  getSalesforceServerDate,
};
