export const COMPANY_OPTIONS = ['Lince', 'Lercara', 'Zumbi'];

export const BANK_OPTIONS = [
  'Banco Nación',
  'Banco Galicia',
  'Banco Santander',
  'Banco Provincia',
  'Banco Macro',
  'Banco Supervielle',
  'Mercado Pago',
];

export const ACCOUNT_TYPE_OPTIONS = [
  'Caja de ahorro $',
  'Caja de ahorro u$s',
  'Cuenta corriente $',
  'Cuenta corriente u$s',
];

export type AccountTypeOption = (typeof ACCOUNT_TYPE_OPTIONS)[number];

export const ACCOUNT_REF_SEPARATOR = ' · ';
