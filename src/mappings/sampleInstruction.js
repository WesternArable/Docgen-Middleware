const objectApiName = 'Sample_Instruction__c';

const fieldPaths = [
  'Name',
  'Date__c',
  'Displayed_location__c',
  'Telephone__c',
  'Mobile__c',
  'Commodity__c.Name',
  'Tonnage__c',
  'Instruction__c',
  'Sampler__c.Name',
  'Account__c.Name',
];

function map(data) {
  const root = data.Sample_Instruction__c || data || {};
  const sampler = data.Sampler__c || root.Sampler__c || {};
  const account = data.Account__c || root.Account__c || {};
  const commodity = data.Commodity__c || root.Commodity__c || {};
  return {
    'Sample_Instruction__c.Name': root.Name ?? '',
    'Sample_Instruction__c.Date__c': root.Date__c ?? '',
    'Sample_Instruction__c.Displayed_location__c': root.Displayed_location__c ?? '',
    'Sample_Instruction__c.Telephone__c': root.Telephone__c ?? '',
    'Sample_Instruction__c.Mobile__c': root.Mobile__c ?? '',
    'Commodity__c.Name': commodity.Name ?? '',
    'Sample_Instruction__c.Tonnage__c': root.Tonnage__c ?? '',
    'Sample_Instruction__c.Instruction__c': root.Instruction__c ?? '',
    'Sampler__c.Name': sampler.Name ?? '',
    'Account__c.Name': account.Name ?? '',
    'Sampler.Name': sampler.Name ?? '',
    'Account.Name': account.Name ?? '',
  };
}

module.exports = { objectApiName, fieldPaths, map };
