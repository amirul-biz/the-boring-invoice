export interface IBusinessAddress {
  addressLine1: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

export interface IBusinessInfo {
  id?: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  msicCode: string;
  categoryCode: string;
  userSecretKey: string;
  idType?: string;
  sstRegistrationNumber?: string;
  address?: IBusinessAddress;
  invoiceVersion?: string;
}

export interface IBusinessInfoPublic {
  id: string;
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  msicCode: string;
  categoryCode: string;
  idType?: string;
  sstRegistrationNumber?: string;
  address?: IBusinessAddress;
  invoiceVersion?: string;
}
