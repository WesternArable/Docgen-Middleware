const objectApiName = 'Opportunity';
const fieldPaths = [
  'Name',
  'Amount',
  'CloseDate',
  'AccountId.Name',
  'AccountId.AccountNumber',
  'Account.Broker__c',
];

function map(data) {
  return {
    deal_name: data.Name,
    amount: data.Amount,
    close_date: data.CloseDate,
    account_name: data?.AccountId?.Name || data.AccountName
  };
}

module.exports = { objectApiName, fieldPaths, map };