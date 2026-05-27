const axios = require('axios');

async function fetchTemplate(templateUrl, accessToken) {
  const response = await axios.get(templateUrl, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response.data;
}

module.exports = { fetchTemplate };