export interface BusinessAddress {
  addressLine1: string;
  city: string;
  postcode: string;
  state: string;
  country: string;
}

export interface CreateBusinessInfoBody {
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  msicCode: string;
  categoryCode: string;
  userSecretKey: string;
  idType: string;
  sstRegistrationNumber?: string;
  address: BusinessAddress;
  invoiceVersion: string;
}

export interface CreateBusinessInfoData extends CreateBusinessInfoBody {
  userId: string;
}

export interface BusinessInfoPublicData {
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
  address?: BusinessAddress;
  invoiceVersion: string;
}

export interface PaymentIntegrationCredential {
  categoryCode: string;
  userSecretKey: string;
}

export interface UpdateBusinessInfoData {
  businessName?: string;
  businessEmail?: string;
  taxIdentificationNumber?: string;
  businessRegistrationNumber?: string;
  businessActivityDescription?: string;
  msicCode?: string;
  categoryCode?: string;
  userSecretKey?: string;
  idType?: string;
  sstRegistrationNumber?: string;
  address?: Partial<BusinessAddress>;
  invoiceVersion?: string;
}
