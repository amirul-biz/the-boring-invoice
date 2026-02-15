export interface CreateBusinessInfoBody {
  businessName: string;
  businessEmail: string;
  taxIdentificationNumber: string;
  businessRegistrationNumber: string;
  businessActivityDescription: string;
  categoryCode: string;
  userSecretKey: string;
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
  categoryCode: string;
}

export interface UpdateBusinessInfoData {
  businessName?: string;
  businessEmail?: string;
  taxIdentificationNumber?: string;
  businessRegistrationNumber?: string;
  businessActivityDescription?: string;
  categoryCode?: string;
  userSecretKey?: string;
}
