const objectApiName = 'Sample_Result__c';

const fieldPaths = [
  'Name',
  'Date__c',
  'Sample_location__c',
  'Moisture__c',
  'Specific_Weight__c',
  'Nitrogen__c',
  'Protein__c',
  'Hagberg__c',
  'SCR_S_20__c',
  'SCR_S_225__c',
  'SCR_S_25__c',
  'Hardness__c',
  'Admixture_Sum__c',
  'Instruction__c.Name',
  'Instruction__c.Commodity__c.Name',
  'Instruction__c.Variety__c.Name',
  'Instruction__c.Account__c.Name',
];

function map(data) {
  const root = data.Sample_Result__c || data || {};
  const instruction =
    data.Instruction__c ||
    root.Instruction__c ||
    {};
  const commodity = instruction.Commodity__c || instruction.Commodity__r || {};
  const variety = instruction.Variety__c || instruction.Variety__r || {};
  const account = data.Account__c || instruction.Account__c || instruction.Account__r || {};

  const proteinValue = root.Protein__c ?? root.Nitrogen__c ?? '';
  const nitrogenValue = root.Nitrogen__c ?? root.Protein__c ?? '';
  const instructionName = instruction.Name ?? '';
  const commodityName = commodity.Name ?? instruction.Commodity__r?.Name ?? instruction.Commodity__c ?? '';
  const varietyName =
    variety.Name ?? instruction.Variety__r?.Name ?? instruction.Variety__c ?? '';
  const accountName =
    account.Name ?? instruction.Account__r?.Name ?? instruction.Account__c ?? '';

  return {
    'Sample_Result__c.Name': root.Name ?? '',
    'Sample_Result__c.Date__c': root.Date__c ?? '',
    'Sample_Result__c.Sample_location__c': root.Sample_location__c ?? '',
    'Sample_Result__c.Moisture__c': root.Moisture__c ?? '',
    'Sample_Result__c.Specific_Weight__c': root.Specific_Weight__c ?? '',
    'Sample_Result__c.Nitrogen__c': nitrogenValue,
    'Sample_Result__c.Protein__c': proteinValue,
    'Sample_Result__c.Hagberg__c': root.Hagberg__c ?? '',
    'Sample_Result__c.SCR_S_20__c': root.SCR_S_20__c ?? '',
    'Sample_Result__c.SCR_S_225__c': root.SCR_S_225__c ?? '',
    'Sample_Result__c.SCR_S_25__c': root.SCR_S_25__c ?? '',
    'Sample_Result__c.Hardness__c': root.Hardness__c ?? '',
    'Sample_Result__c.Admixture_Sum__c': root.Admixture_Sum__c ?? '',

    'Instruction__c.Name': instructionName,
    'Instruction__c.Commodity__c.Name': commodityName,
    'Instruction__c.Variety__c.Name': varietyName,
    'Instruction__c.Account__c.Name': accountName,
    'Account__c.Name': accountName,

    today: '',
  };
}

module.exports = { objectApiName, fieldPaths, map };
