const objectApiName = 'Movement_Sheet__c';

const fieldPaths = [
  'Name',
  'Grower_BillingPostalCode__c',
  'Purchaser_BillingPostalCode__c',
  'Tonnage__c',
  'Sales_Price__c',
  'Commodity__c',
  'Price_Tonne__c',
  'Buyer_Reference__c',
  'Delivery_Address__c',
  'Month_of_Movement__c',
  'Position__c',
  'Delivery_Reference__c',
  'Payment_Date__c',
  'Payment_Terms__c',
  'Purchase_Contract__c.Name',
  'Sales_Contract__c.Name',
  'Haulier__c.Name',
  'Weight_Total_To_Date__c',
];

function map(data) {
  const root = data.Movement_Sheet__c || data || {};
  const haulier = data.Haulier__c || root.Haulier__c || {};
  const purchaseContract = data.Purchase_Contract__c || root.Purchase_Contract__c || {};
  const salesContract = data.Sales_Contract__c || root.Sales_Contract__c || {};

  return {
    'Movement_Sheet__c.Name': root.Name ?? '',
    'Movement_Sheet__c.Grower_BillingPostalCode__c': root.Grower_BillingPostalCode__c ?? '',
    'Movement_Sheet__c.Purchaser_BillingPostalCode__c': root.Purchaser_BillingPostalCode__c ?? '',
    'Movement_Sheet__c.Tonnage__c': root.Tonnage__c ?? '',
    'Movement_Sheet__c.Sales_Price__c': root.Sales_Price__c ?? '',
    'Movement_Sheet__c.Commodity__c': root.Commodity__c ?? '',
    'Movement_Sheet__c.Price_Tonne__c': root.Price_Tonne__c ?? '',
    'Movement_Sheet__c.Buyer_Reference__c': root.Buyer_Reference__c ?? '',
    'Movement_Sheet__c.Delivery_Address__c': root.Delivery_Address__c ?? '',
    'Movement_Sheet__c.Month_of_Movement__c': root.Month_of_Movement__c ?? '',
    'Movement_Sheet__c.Position__c': root.Position__c ?? '',
    'Movement_Sheet__c.Delivery_Reference__c': root.Delivery_Reference__c ?? '',
    'Movement_Sheet__c.Payment_Date__c': root.Payment_Date__c ?? '',
    'Movement_Sheet__c.Payment_Terms__c': root.Payment_Terms__c ?? '',
    'Purchase_Contract__c.Name': purchaseContract.Name ?? '',
    'Sales_Contract__c.Name': salesContract.Name ?? '',
    'Haulier__c.Name': haulier.Name ?? '',
    'Weight_Total_To_Date__c': root.Weight_Total_To_Date__c ?? '',
  };
}

module.exports = { objectApiName, fieldPaths, map };
