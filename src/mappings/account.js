const objectApiName = 'Account';
const fieldPaths = [
  'Name',
  'AccountNumber',
  'Phone',
  'Website',
  'Type',
  'Industry',
];

function map(data) {
  return {
    account_name: data.Name,
    account_number: data.AccountNumber,
    account_phone: data.Phone,
    account_site: data.Website,
    account_type: data.Type,
    account_industry: data.Industry,
  };
}

module.exports = { objectApiName, fieldPaths, map };
